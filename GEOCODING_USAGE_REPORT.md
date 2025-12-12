# Relatório de Uso da Geocoding API e Serviços Google Maps

Este relatório detalha todos os pontos do projeto onde a **Geocoding API** e serviços relacionados do Google Maps são utilizados. O projeto utiliza uma abordagem híbrida, consumindo serviços tanto no lado do servidor (Server Actions) quanto no lado do cliente (Browser).

## 1. Resumo Geral

*   **Chave de API:** O projeto utiliza a variável de ambiente `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para todas as requisições, tanto no servidor quanto no cliente.
*   **Serviços Detectados:**
    *   **Geocoding API (Server-side):** Conversão de Endereço ↔ Coordenadas.
    *   **Maps JavaScript API (Client-side):** Mapas interativos, Geocoding visual e Autocomplete.
    *   **Places API (Client-side):** Sugestão de endereços (`AddressInput`).
    *   **Routes API (Server-side):** Cálculo de rotas e distância.
    *   **Weather API (Server-side):** Previsão do tempo baseada em localização.

---

## 2. Uso no Lado do Servidor (Server Actions)

Estas chamadas são executadas no ambiente Node.js (Next.js server) e consomem cotas de "Web Services". Elas são críticas pois centralizam a lógica de obtenção de dados geográficos para persistência no banco de dados.

**Arquivo Principal:** `src/lib/data-server-actions.ts`

| Função | Endpoint / Serviço | Descrição |
| :--- | :--- | :--- |
| `geocodeAddress(address)` | `GET https://maps.googleapis.com/maps/api/geocode/json` | **Geocoding Direto.** Converte um endereço em texto para coordenadas (`lat`, `lng`). Usado extensivamente para salvar a localização de bases, clientes e destinos. |
| `getCityFromAddressAction` | `GET .../geocode/json?latlng=...` | **Reverse Geocoding.** Obtém a cidade a partir de coordenadas. |
| `getNeighborhoodFromAddressAction` | `GET .../geocode/json?latlng=...` | **Reverse Geocoding.** Obtém o bairro a partir de coordenadas. |
| `getDirectionsAction` | `POST https://routes.googleapis.com/directions/v2:computeRoutes` | **Routes API.** Calcula distância e duração entre dois pontos. Essencial para cálculo de custos de frete. |
| `getWeatherForecastAction` | `GET https://weather.googleapis.com/v1/forecast/hours:lookup` | **Weather API.** Obtém previsão do tempo para uma data/hora e local específicos. |

**Fluxos de IA e Planejamento:**
*   `src/ai/flows/traffic-analysis-flow.ts`: Usa `geocodeAddress` para converter paradas de rota em coordenadas para análise de tráfego.
*   `src/app/route-planning/page.tsx`: Usa `geocodeAddress` para definir o ponto de partida da otimização de rotas.

---

## 3. Uso no Lado do Cliente (Client Components)

Estas chamadas ocorrem diretamente no navegador do usuário e consomem cotas da "Maps JavaScript API".

**Arquivo Principal:** `src/lib/maps-api.ts` e componentes de UI.

| Componente / Arquivo | Serviço Google | Descrição |
| :--- | :--- | :--- |
| `src/lib/maps-api.ts` | `window.google.maps.Geocoder` | Wrapper cliente para **Geocoding** e **Reverse Geocoding**. |
| `src/components/map-dialog.tsx` | Maps JavaScript API | Exibe o mapa interativo para seleção manual de local. Usa o `Geocoder` cliente para converter cliques no mapa em endereços. |
| `src/components/address-input.tsx` | **Places API** (Autocomplete) | Componente de input que sugere endereços enquanto o usuário digita (`StandaloneSearchBox`). |

---

## 4. Padrão Híbrido: Formulários Cliente chamando Server Actions

Uma característica importante deste projeto é que os formulários de criação/edição (que são "Client Components") invocam **Server Actions** para realizar o geocoding, em vez de usar a API do cliente (exceto no `MapDialog`).

**Arquivos Afetados:**
*   `src/app/operations/new/operation-form.tsx`
*   `src/app/rentals/new/rental-form.tsx`
*   `src/app/operations/[id]/edit/edit-operation-form.tsx`
*   `src/app/rentals/[id]/edit/edit-rental-form.tsx`

**Comportamento:**
Quando um usuário seleciona uma base ou cliente, ou digita um endereço (e sai do campo), o componente dispara `geocodeAddress(address)` que roda no **servidor**. Isso garante que a coordenada salva no banco de dados venha de uma fonte confiável e consistente (o servidor), mas consome quota da Geocoding API (Web Service) a cada interação, em vez da cota da Maps JS API.

**Exceção:** O componente `AddressInput` (usado dentro desses formulários) usa a **Places API** no cliente para autocompletar, mas a conversão final para persistência muitas vezes é revalidada ou complementada pelas Server Actions.
