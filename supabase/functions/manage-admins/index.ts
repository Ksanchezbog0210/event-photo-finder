import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user's token to verify they're admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Check if requesting user is admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Not authorized");

    const { action, email, user_id } = await req.json();

    if (action === "list") {
      // Get all admin user_ids
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (!roles?.length) {
        return new Response(JSON.stringify({ admins: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get emails from auth.users using admin API
      const admins = [];
      for (const role of roles) {
        const { data: { user: adminUser } } = await adminClient.auth.admin.getUserById(role.user_id);
        if (adminUser) {
          admins.push({ user_id: role.user_id, email: adminUser.email || "Sin email" });
        }
      }

      return new Response(JSON.stringify({ admins }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add") {
      if (!email) throw new Error("Email is required");

      // Find user by email
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users.find((u) => u.email === email);
      if (!targetUser) throw new Error("No se encontró un usuario con ese email. Debe registrarse primero.");

      // Check if already admin
      const { data: existing } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUser.id)
        .eq("role", "admin")
        .maybeSingle();

      if (existing) throw new Error("Este usuario ya es administrador");

      const { error } = await adminClient.from("user_roles").insert({
        user_id: targetUser.id,
        role: "admin",
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      if (!user_id) throw new Error("user_id is required");
      if (user_id === user.id) throw new Error("No puedes removerte a ti mismo como admin");

      const { error } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", "admin");
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
