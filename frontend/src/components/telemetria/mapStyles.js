/**
 * Camadas de mapa disponíveis na telemetria (compartilhadas entre telas).
 *
 * `maxNativeZoom` = último nível em que o provedor tem imagem para o Brasil.
 * Acima dele o Leaflet amplia o último nível disponível em vez de pedir
 * blocos que não existem (a Esri devolve "Map data not yet available").
 * Assim todas as camadas aproximam até MAP_MAX_ZOOM sem tela cinza.
 */
export const MAP_MAX_ZOOM = 20;

export const FLEET_MAP_STYLES = {
  modern: {
    label: "Mapa moderno",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 17,
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom",
    subdomains: null,
  },
  satellite: {
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 18,
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    subdomains: null,
  },
  dark: {
    label: "Mapa escuro",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 16,
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS",
    subdomains: null,
  },
  streets: {
    label: "Ruas (OSM)",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abc",
  },
};

