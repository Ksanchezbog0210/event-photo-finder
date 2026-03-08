import sample1 from "@/assets/sample-1.jpg";
import sample2 from "@/assets/sample-2.jpg";
import sample3 from "@/assets/sample-3.jpg";
import sample4 from "@/assets/sample-4.jpg";
import sample5 from "@/assets/sample-5.jpg";
import sample6 from "@/assets/sample-6.jpg";

export interface EventPhoto {
  id: string;
  src: string;
  thumbnail: string;
  hasFace: boolean;
  matchScore?: number;
}

export interface EventData {
  id: string;
  code: string;
  name: string;
  date: string;
  location: string;
  photoCount: number;
  photos: EventPhoto[];
  pricePerPhoto: number;
  currency: string;
  freePhotos: number;
}

export const MOCK_EVENTS: EventData[] = [
  {
    id: "evt-001",
    code: "CARRERA2026",
    name: "Maratón Nacional Costa Rica 2026",
    date: "2026-03-01",
    location: "San José, Costa Rica",
    photoCount: 847,
    pricePerPhoto: 2,
    currency: "USD",
    freePhotos: 1,
    photos: [
      { id: "p1", src: sample1, thumbnail: sample1, hasFace: true, matchScore: 0.95 },
      { id: "p2", src: sample2, thumbnail: sample2, hasFace: true, matchScore: 0.88 },
      { id: "p3", src: sample3, thumbnail: sample3, hasFace: true, matchScore: 0.72 },
      { id: "p4", src: sample4, thumbnail: sample4, hasFace: true, matchScore: 0.91 },
      { id: "p5", src: sample5, thumbnail: sample5, hasFace: false },
      { id: "p6", src: sample6, thumbnail: sample6, hasFace: true, matchScore: 0.65 },
    ],
  },
];

export const SINPE_INFO = {
  phone: "89406622",
  name: "FotoFind CR",
  banco: "Banco Nacional de Costa Rica",
};

export function getEventByCode(code: string): EventData | undefined {
  return MOCK_EVENTS.find(
    (e) => e.code.toLowerCase() === code.toLowerCase()
  );
}

export function getMatchingPhotos(event: EventData): EventPhoto[] {
  return event.photos
    .filter((p) => p.hasFace && (p.matchScore ?? 0) > 0.6)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}
