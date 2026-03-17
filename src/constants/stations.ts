export const STATIONS = [
  {
    id: "659a82e0-6f43-432e-acf9-af733a7e1ef6",
    name: "Pure",
  },
  {
    id: "cdc9288e-8e59-43d9-a69d-404b8a936039",
    name: "Station 2",
  },
  {
    id: "7b143ea2-0e69-4a54-95ff-e07383ee664d",
    name: "Station 3",
  },
  {
    id: "e9699fc9-3bc1-4d04-be64-68ae4865b39a",
    name: "Station 4",
  },
  {
    id: "15b2a5bb-da9f-43a9-808e-ffeb47ca040a",
    name: "Station 5",
  },
];

export const MENU_URLS = STATIONS.map(
  (s) => `https://eat.sifted.co/meals/${s.id}`
);
