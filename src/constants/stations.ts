export interface StationConfig {
  id: string;
  name: string;
  imageUrl: string;
}

export const STATIONS: StationConfig[] = [
  {
    id: "7b143ea2-0e69-4a54-95ff-e07383ee664d",
    name: "Wok n Tandoor",
    imageUrl: "https://images.sifted-dev.co/brands/WoknTandoor.svg",
  },
  {
    id: "b507148b-aead-4e34-9542-828494b6bbc3",
    name: "Hot Hands",
    imageUrl: "https://images.sifted-dev.co/brands/HotHands.svg",
  },
  {
    id: "cdc9288e-8e59-43d9-a69d-404b8a936039",
    name: "Rotating Plate",
    imageUrl: "https://images.sifted-dev.co/brands/RotatingPlate.svg",
  },
  {
    id: "659a82e0-6f43-432e-acf9-af733a7e1ef6",
    name: "Pure",
    imageUrl: "https://images.sifted-dev.co/brands/pure.svg",
  },
  {
    id: "e9699fc9-3bc1-4d04-be64-68ae4865b39a",
    name: "Sweet Spot",
    imageUrl: "https://images.sifted-dev.co/brands/SweetSpot.svg",
  },
  {
    id: "15b2a5bb-da9f-43a9-808e-ffeb47ca040a",
    name: "Wrap Culture",
    imageUrl: "https://images.sifted-dev.co/brands/WrapCulture.svg",
  },
];

export const STATION_IMAGES: Record<string, string> = STATIONS.reduce(
  (acc, station) => {
    acc[station.id] = station.imageUrl;
    return acc;
  },
  {} as Record<string, string>,
);

export const MENU_URLS = STATIONS.map(
  (s) => `https://eat.sifted.co/meals/${s.id}`,
);
