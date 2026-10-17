# Floorplan Lights Card

Tarjeta Lovelace para Home Assistant que dibuja el plano de la casa por plantas para ver y controlar las luces:

- **Plano de arquitecto** a escala (metros): fachada, tabiques, huecos de puerta, cristaleras, puerta de garaje, estancias y rótulos.
- **Cada luz** es un punto en su sitio. Encendida, ilumina su estancia, y la luz se para en las paredes. Las luces RGB brillan con su color real y el brillo cambia el halo.
- **Tocar** enciende o apaga; **mantener** abre el detalle de HA.
- **Selector de planta** tipo ascensor (1, 0, −1) con cuántas luces hay encendidas en cada una, y **«Apagar planta»** con confirmación.
- **Modo día o noche** según el tema de HA (o fijo con `theme`).
- **`compact: true`** para una portada: ascensor y miniplano.
- **`config_from: <path>`**: usa el plano de la tarjeta de otra pestaña del mismo panel, para no duplicarlo.

## Editor visual

Desde el editor de tarjetas de HA, con el plano en vivo:

- **Luces**: añadir (elige «Añadir luz» y toca el sitio), quitar, arrastrar o fijar X/Y, entidad, nombre, color y exterior.
- **Estancias**: cambiar el tamaño arrastrando un borde o una esquina, nombre y exterior. Cada luz pertenece a la estancia en la que cae.
- **Rótulos**: mover, X/Y, texto y tamaño; rótulos sueltos nuevos.

La **estructura** (fachada, paredes y puertas) no se toca desde el editor visual: se cambia en el YAML.

## Instalación (HACS)

1. HACS → menú ⋮ → *Repositorios personalizados* → `https://github.com/serweck/floorplan-lights-card`, tipo *Dashboard*.
2. Instala **Floorplan Lights Card** y recarga el navegador.

## Configuración

```yaml
type: custom:floorplan-lights-card
title: Luces              # opcional
compact: false            # opcional
theme: auto               # auto | day | night
default_floor: pb         # opcional; si no, la primera planta con luz encendida
floors:
  - id: pb                # obligatorio
    name: Planta baja     # obligatorio
    short: Baja
    level: "0"
    outline: [[0, 0], [8, 0], [8, 6], [0, 6]]      # fachada, obligatoria
    walls: [[4, 0, 4, 6]]                          # x1, y1, x2, y2
    doors:                                         # huecos: h en y = at, v en x = at, de a a b
      - { o: v, at: 4, a: 2.5, b: 3.3 }
      - { o: h, at: 6, a: 5, b: 6.2, k: main }     # k: glass, open, window, garage, main
    rooms:
      - { id: salon, name: Salón, poly: [[0.1, 0.1], [3.95, 0.1], [3.95, 5.9], [0.1, 5.9]] }
      - { id: terraza, name: Terraza, ext: true, poly: [[0, -2.5], [8, -2.5], [8, 0], [0, 0]] }
    labels:
      - { text: Jardín, x: 4, y: -1.2, fs: 0.36 }
    lights:
      - { entity: light.salon, x: 2, y: 3 }
      - { entity: light.hue, x: 3, y: 1.5, color: "#b98cff" }
      - { entity: light.porche, x: 1, y: -1.2, ext: true }
```

Para una portada que reutilice ese plano:

```yaml
type: custom:floorplan-lights-card
compact: true
config_from: luces        # path de la pestaña que tiene la tarjeta completa
```

## Desarrollo

`npm install`, `npm test`, `npm run build` y `npm run preview` (abre `preview.html`; con un `preview-config.json` local usa ese plano, y si no, uno de ejemplo).
