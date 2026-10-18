# Royal Felt — Simulador Web Profesional de Blackjack de Casino

Aplicación web interactiva que simula una partida auténtica de **Blackjack de casino** desde la perspectiva en primera persona de un jugador sentado frente a la mesa. Cuenta con motor de reglas de casino configurable y determinista, contabilidad exacta de fichas virtuales, múltiples barajas con barajado uniforme **Fisher-Yates**, acciones completas (*Hit*, *Stand*, *Double Down*, *Split*, *Insurance*, *Late Surrender*), historial de manos, estadísticas de sesión y entorno 100% contenerizado mediante **Docker**.

---

## 1. Características Principales

- **Perspectiva Inmersiva en 1.ª Persona (Estilo Cartoon Refinado)**:
  - Mesa curva de fieltro verde esmeralda con inscripciones dinámicas según las reglas activas, borde inferior de madera/cuero acolchado, cartas vectoriales ilustradas y fichas 2.5D apilables.
  - Privacidad estricta de la carta oculta (*hole card*) del crupier: la interfaz recibe una vista sanitizada (`getPublicDealerView`) que oculta palo y valor en el DOM hasta el turno del crupier.
  - Respeto automático por la preferencia del sistema `prefers-reduced-motion: reduce`.
- **Motor Puro de Blackjack Desacoplado de la Interfaz (`src/engine/`)**:
  - **Zapato configurable**: `1`, `2`, `4`, `6` u `8` barajas de 52 cartas físicas con identificadores únicos (`deck-{i}-{suit}-{rank}`).
  - **Barajado Fisher-Yates**: Utiliza `crypto.getRandomValues` (CSPRNG) por defecto y permite inyectar generadores deterministas para pruebas automatizadas.
  - **Política de penetración y corte**: Rebaraja automáticamente **solo entre manos** cuando se alcanza la carta de corte (75% de penetración por defecto).
  - **Evaluación exacta de manos**: Ajuste dinámico de múltiples Ases (`11` o `1`), distinción entre manos suaves (*soft*) y duras (*hard*), y diferenciación estricta entre **Blackjack natural** (2 cartas iniciales = 21) y `21` alcanzado con 3+ cartas o tras dividir.
- **Acciones Auténticas de Casino**:
  - **Pedir (*Hit*)** y **Plantarse (*Stand*)**.
  - **Doblar (*Double Down*)**: Duplica la apuesta de la mano activa, descuenta las fichas adicionales, reparte exactamente una carta y cierra el turno de esa mano.
  - **Dividir (*Split*)**: Divide parejas elegibles hasta un máximo configurable de `2`, `3` o `4` manos independientes, aplicando la regla estándar de Ases divididos (1 carta por cada As dividido).
  - **Seguro (*Insurance*)**: Se ofrece cuando la carta visible del crupier es un As (hasta la mitad de la apuesta inicial, paga `2:1`).
  - **Rendición Tardía (*Late Surrender*)**: Permite abandonar la mano inicial de 2 cartas recuperando el 50% de la apuesta.
- **Sistema de Fichas Virtuales y Contabilidad Verificable**:
  - Denominaciones de `1`, `5`, `25`, `100` y `500` fichas con descomposición automática en pilas visuales.
  - Controles rápidos (`Limpiar`, `1/2`, `x2`, `Máx` e importe numérico exacto).
  - Liquidación atómica e idempotente (`settledRoundIds`) que impide liquidar una misma ronda dos veces.
- **Estadísticas, Historial y Persistencia Segura**:
  - Paneles discretos de **Configuración de Mesa**, **Estadísticas de Sesión**, **Historial de Manos**, **Guía de Reglas** y **Confirmación de Reinicio**.
  - Persistencia en `localStorage` restringida exclusivamente a estados íntegros entre rondas (`BETTING`, `ROUND_OVER`, `OUT_OF_CHIPS`).

---

## 2. Arquitectura del Proyecto

```text
BlackJack_Simulator/
├── Dockerfile                        # Imagen multi-etapa (base, dev, test, build, prod Nginx)
├── docker-compose.yml                # Servicios Docker: app (dev HMR), test (Vitest + tsc), prod (Nginx)
├── package.json                      # Scripts y dependencias (React 19, TypeScript 5, Vite 6, Vitest 2)
├── tsconfig.json                     # Configuración TypeScript en modo estricto
├── vite.config.ts                    # Configuración de Vite (0.0.0.0:5173) y Vitest (jsdom)
└── src/
    ├── engine/                       # Motor puro de Blackjack (sin dependencias de React ni DOM)
    │   ├── types.ts                  # Contratos de datos, estados, cartas, reglas y resúmenes
    │   ├── deck.ts                   # Creación de barajas, zapato, Fisher-Yates y penetración
    │   ├── scoring.ts                # Cálculo de puntuaciones duras/suaves y Blackjack natural
    │   ├── rules.ts                  # Reglas predeterminadas, política S17/H17 y validadores de acciones
    │   ├── accounting.ts             # Fichas, preparación de apuestas, tabla de pagos y diagnósticos
    │   └── gameEngine.ts             # Máquina de estados finita (FSM) y resolución de rondas
    ├── state/                        # Gestión de sesión y persistencia
    │   ├── storage.ts                # Estadísticas de sesión y persistencia segura en localStorage
    │   └── useBlackjackGame.ts       # Hook conector entre el motor puro y la interfaz React
    ├── components/                   # Componentes visuales (Estética Cartoon en 1.ª persona)
    │   ├── Cards/PlayingCard.tsx     # Cartas vectoriales con reverso seguro para carta oculta
    │   ├── Chips/CasinoChip.tsx      # Fichas de casino por denominación (1, 5, 25, 100, 500)
    │   ├── Chips/BettingZone.tsx     # Círculo de apuesta con pilas de fichas interactivas
    │   ├── Controls/ActionControls.tsx # Botonera inferior contextual de apuestas y acciones
    │   ├── Panels/SessionPanels.tsx  # Modales de Configuración, Estadísticas, Historial, Reglas y Reinicio
    │   └── Table/BlackjackTable.tsx  # Superficie principal de la mesa, HUD y zapato ilustrado
    ├── styles/
    │   └── table.css                 # Sistema de diseño visual, animaciones y reglas responsive
    └── __tests__/                    # Suite de 42 pruebas automatizadas (8 archivos)
        ├── scoring.test.ts
        ├── deck.test.ts
        ├── coreEngine.test.ts
        ├── accounting.test.ts
        ├── uiComponents.test.tsx
        ├── gameflow.test.tsx
        ├── session.test.tsx
        └── integration.test.tsx
```

---

## 3. Reglas Predeterminadas y Opciones Configurables

| Regla | Valor Predeterminado | Opciones Soportadas en el Motor |
| :--- | :--- | :--- |
| **Saldo Inicial** | `1,000` fichas | `500`, `1,000`, `2,500`, `5,000`, `10,000` o personalizado |
| **Número de Barajas** | `6` barajas (312 cartas) | `1`, `2`, `4`, `6`, `8` barajas |
| **Penetración del Zapato** | `75%` (rebaraja al quedar $\le 25\%$) | Rebarajado automático solo entre manos |
| **Regla del Crupier en 17** | `S17` (Se planta en todo 17) | `S17` (Stand on All 17s) / `H17` (Hit on Soft 17) |
| **Pago de Blackjack Natural** | `3:2` | `3:2` / `6:5` |
| **Seguro (*Insurance*)** | Habilitado (paga `2:1`) | Habilitado / Deshabilitado |
| **Rendición (*Surrender*)** | Rendición tardía (`late`) | Rendición tardía (devuelve 50%) / Deshabilitada (`none`) |
| **Doblar tras Dividir (DAS)** | Habilitado | Habilitado / Deshabilitado |
| **Restricción de Doblar** | Cualquier par inicial (`any`) | `any` / Solo `9-11` / Solo `10-11` |
| **Dividir Cartas de Valor 10** | Deshabilitado (exige mismo rango) | Mismo rango exacto (`K-K`) / Cualquier valor 10 (`10-Q`) |
| **Re-dividir Ases (RSA)** | Deshabilitado | Habilitado / Deshabilitado |
| **Máximo de Manos Divididas** | `4` manos | `2`, `3` o `4` manos |
| **Límites de Apuesta** | Mín: `10` / Máx: `500` | Configurables antes de cada mano |

---

## 4. Tabla de Pagos

Con una apuesta principal de `100` fichas (descontada al confirmar el reparto):

- **Blackjack Natural (`3:2`)**: Ganancia neta de `+150` fichas (recibe `250` fichas en total).
- **Blackjack Natural (`6:5`)**: Ganancia neta de `+120` fichas (recibe `220` fichas en total).
- **Victoria Normal (`1:1`)**: Ganancia neta de `+100` fichas (recibe `200` fichas en total).
- **Empate (*Push*)**: Ganancia neta de `0` fichas (recupera las `100` fichas apostadas).
- **Rendición Tardía (*Surrender*)**: Pérdida neta de `-50` fichas (recupera `50` fichas).
- **Derrota o *Bust***: Pérdida neta de `-100` fichas (recibe `0` fichas).
- **Seguro Ganador (`2:1`)**: Con apuesta de seguro de `50` fichas, ganancia neta de `+100` fichas sobre el seguro (recibe `150` fichas).

---

## 5. Instalación, Ejecución y Pruebas con Docker (Recomendado)

El proyecto está configurado para ejecutarse íntegramente mediante **Docker** y **Docker Compose**.

### 5.1 Levantar el servidor de desarrollo (Puerto `5173`)

```bash
docker compose up -d --build app
```

Una vez iniciado el contenedor `blackjack-simulator-dev`, abre en tu navegador:
- **URL**: `http://localhost:5173`

### 5.2 Ejecutar verificación de tipos TypeScript y pruebas automatizadas en Docker

Con el contenedor de desarrollo activo:

```bash
docker exec blackjack-simulator-dev sh -c "npm run typecheck && npm test"
```

O ejecutando el contenedor dedicado de pruebas (`test`):

```bash
docker compose run --rm --build test
```

### 5.3 Compilar para producción o levantar servidor Nginx (Puerto `8080`)

```bash
# Verificar build dentro del contenedor activo
docker exec blackjack-simulator-dev npm run build

# O levantar la imagen de producción con Nginx en http://localhost:8080
docker compose --profile prod up -d --build prod
```

### 5.4 Ejecución local alternativa (sin Docker)

Si se desea ejecutar directamente con Node.js (`v22+`):

```bash
npm install
npm run dev        # Servidor de desarrollo
npm run typecheck  # Verificación estática de tipos TypeScript
npm test           # Suite completa de 42 pruebas en Vitest
npm run build      # Compilación de producción en dist/
```

---

## 6. Limitaciones Conocidas y Decisiones de Diseño

1. **Persistencia entre manos**: Por seguridad financiera de la sesión, `localStorage` guarda el progreso únicamente cuando una ronda ha concluido o antes de repartir (`BETTING`, `ROUND_OVER`, `OUT_OF_CHIPS`). Si el usuario recarga el navegador a mitad de una mano no resuelta, la sesión restaura el estado al final de la última mano completada para impedir la duplicación o pérdida injustificada de pagos.
2. **Simulación 100% con fichas virtuales**: Todas las operaciones utilizan saldo virtual de práctica en el cliente; no existe conexión con pasarelas de pago ni apuestas con dinero real.
