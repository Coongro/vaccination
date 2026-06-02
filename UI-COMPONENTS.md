# UI Components Reference

Catálogo de componentes disponibles en `@coongro/ui-components`, expuestos via `getHostUI()`.

```ts
import { getHostUI } from '@coongro/plugin-sdk';
const UI = getHostUI();

// Usar: React.createElement(UI.Button, { variant: 'outline' }, 'Click')
```

---

## Reglas Fundamentales

| NUNCA | SIEMPRE |
|-------|---------|
| Crear loading states manuales (`<div>Cargando...</div>`) | Usar `LoadingOverlay` (`variant`: spinner/skeleton/dots, `inline` para compacto) |
| Crear empty states manuales (`<div>No hay datos</div>`) | Usar `EmptyState` (`title`, `description`, `icon`, `action`) |
| Crear error states manuales | Usar `ErrorDisplay` (`title`, `message`, `onRetry`) |
| Hardcodear colores (`amber-300`, `blue-500`, `red-600`) | Usar design tokens `cg-*` (ver sección Design Tokens) |
| Crear paginación con botones "Anterior/Siguiente" | Usar `Pagination` + `PaginationContent/Item/Link/Previous/Next/Ellipsis` |
| Input de texto para tags/chips separados por coma | Usar `ChipInput` (`values`, `onValuesChange`) |
| Crear modales con div + overlay manual | Usar `Dialog` / `FormDialog` / `StepDialog` |
| Crear tooltips con CSS hover | Usar `Tooltip` (`content`, `side`, `delayMs`) |
| Crear botones de toggle/switch manuales | Usar `Switch` o `ButtonGroup` |
| Crear skeletons con div animado | Usar `Skeleton` |

---

## Primitivos

### Button
Botón de acción principal con múltiples variantes.
- **variant**: `'default'` | `'destructive'` | `'outline'` | `'secondary'` | `'ghost'` | `'link'` | `'brand'`
- **size**: `'default'` | `'xs'` | `'sm'` | `'lg'` | `'icon'` | `'pill'`
- **asChild**: `boolean` — Slot pattern para composición

### Input
Campo de texto con foco estilizado.
- **size**: `'default'` | `'sm'` | `'lg'`
- Soporta todos los tipos HTML (`text`, `number`, `date`, `tel`, etc.)

### Label
Etiqueta de formulario asociada a inputs.
- Props estándar de `<label>`

### Badge
Indicador de estado o categoría en formato pill.
- **variant**: `'default'` | `'secondary'` | `'destructive'` | `'success'` | `'warning'` | `'brand'` | `'success-soft'` | `'danger-soft'` | `'warning-soft'` | `'info'` | `'outline'` | más
- **size**: `'default'` | `'sm'` | `'lg'`
- **icon**: `ReactNode` — Ícono a la izquierda

### Avatar
Imagen de perfil o iniciales de fallback.
- **name**: `string` — Primer carácter como fallback
- **src**: `string | null` — URL de imagen
- **icon**: `ReactNode` — Fallback personalizado
- **size**: `'xs'` | `'sm'` | `'md'` | `'lg'`

### Chip
Tag compacto con opción de eliminación.
- **variant**: `'default'` | `'brand'`
- **size**: `'sm'` | `'md'`
- **icon**: `ReactNode` — Ícono a la izquierda
- **onRemove**: `() => void` — Muestra botón X si existe

### IconButton
Botón solo con ícono para UI compacta.
- **size**: `'xs'` | `'sm'` | `'md'` | `'lg'`
- **shape**: `'circle'` | `'square'`
- **variant**: `'ghost'` | `'danger'` | `'success'` | `'muted'`

### Separator
Línea divisora visual.
- **orientation**: `'horizontal'` | `'vertical'`

### Skeleton
Placeholder de carga con animación pulse.
- Acepta `className` para dimensiones (`h-4 w-32`, `h-10 rounded-lg`, etc.)

---

## Forms

### Checkbox
Toggle booleano (check/uncheck).
- Props de Radix Checkbox

### Switch
Toggle ON/OFF tipo interruptor.
- Props de Radix Switch

### RadioGroup + RadioGroupItem
Selección única entre múltiples opciones.
- `RadioGroup`: contenedor flex
- `RadioGroupItem`: opción individual

### Textarea
Input de texto multi-línea.
- Props estándar de `<textarea>`

### Select + SelectItem
Dropdown de selección única con búsqueda.
- **value** / **onValueChange**: Valor seleccionado
- **placeholder**: Texto placeholder
- **clearable**: `boolean` (default `true`)
- **debounceMs**: `number` (default 300)

### MultiSelect
Dropdown de selección múltiple con chips.
- **values** / **onValuesChange**: `string[]`
- **renderChip**: Render personalizado para chips

### Combobox
Base flexible para Select/MultiSelect (componente interno).
- **multiple**: `boolean`

### ChipInput
Input multi-valor con chips visuales y eliminación individual.
- **values**: `string[]` — Valores actuales
- **onValuesChange**: `(values: string[]) => void`
- **inputValue** / **onInputChange**: Input controlado
- **placeholder**: `string`
- **renderChip**: Render personalizado
- Backspace elimina el último chip
- Tip: Manejar Enter via `onKeyDown` en el contenedor para agregar chips

### QuantityStepper
Control de incremento/decremento numérico.
- **value**: `number`
- **onChange**: `(value: number) => void`
- **min** / **max**: Límites

### PickerCard
Tarjeta de selección visual (radio visual).
- **icon**: `ReactNode`
- **label**: `string`
- **selected**: `boolean`

---

## Overlays

### Dialog
Modal base con overlay.
- **open** / **onOpenChange**: Estado
- Sub-componentes: `DialogContent` (`size`: sm/md/lg/xl/full), `DialogHeader`, `DialogTitle`, `DialogBody`, `DialogFooter`

### FormDialog
Dialog pre-configurado para formularios. **Usar para la mayoría de modales.**
- **open** / **onOpenChange**: Estado
- **title**: `string`
- **children**: Contenido del formulario
- **footer**: `ReactNode` — Botones
- **size**: `'sm'` | `'md'` | `'lg'`

### StepDialog
Dialog multi-paso (wizard).
- Sub-componentes: `StepDialogContent`, `StepDialogHeader` (con barra de progreso), `StepDialogBody`, `StepDialogFooter`

### Popover
Popover flotante anclado a un trigger.
- **open** / **onOpenChange**: Estado
- **side**: `'top'` | `'bottom'` | `'left'` | `'right'`
- **align**: `'start'` | `'center'` | `'end'`
- Sub-componentes: `PopoverTrigger`, `PopoverContent`

### Tooltip
Popup informativo al hover.
- **content**: `ReactNode` — Texto del tooltip
- **side**: `'top'` | `'bottom'` | `'left'` | `'right'`
- **delayMs**: `number` (default 300)

### Sheet
Panel slide-in desde el borde de pantalla.
- **open** / **onOpenChange**: Estado
- **side**: `'left'` | `'right'`
- Sub-componentes: `SheetContent`, `SheetHeader`

---

## Feedback

### LoadingOverlay
Indicador de carga unificado. **Usar en vez de spinners o textos manuales.**
- **variant**: `'spinner'` | `'skeleton'` | `'dots'`
- **label**: `string` — Texto opcional
- **overlay**: `boolean` — Full-screen con backdrop blur
- **inline**: `boolean` — Modo compacto (ideal dentro de inputs/popovers)
- **rows**: `number` — Filas skeleton (solo variant `'skeleton'`)

### ErrorDisplay
Estado de error con opción de reintentar.
- **title**: `string` (default `'Something went wrong'`)
- **message**: `string`
- **onRetry**: `() => void` — Botón de reintentar
- **icon**: `ReactNode`

### EmptyState
Estado vacío cuando no hay datos. **Usar en vez de divs con texto.**
- **title**: `string` (requerido)
- **description**: `string`
- **icon**: `ReactNode`
- **action**: `ReactNode` — Botón de acción

---

## Layout

### Card
Contenedor con borde y sombra.
- Sub-componentes: `CardHeader`, `CardTitle`, `CardDescription`, `CardBody`, `CardFooter`
- Tip: Usar `className='p-4'` para padding directo en Card simple

### Accordion
Secciones expandibles/colapsables.
- Sub-componentes: `AccordionItem`, `AccordionTrigger`, `AccordionContent`

### ScrollArea
Contenedor scrollable con scrollbar estilizado.
- **orientation**: `'vertical'` | `'horizontal'` | `'both'`

---

## Navigation

### Tabs
Interface con pestañas.
- Sub-componentes: `TabsList`, `TabsTrigger`, `TabsContent`

### Pagination
Controles de paginación semánticos. **Usar en vez de botones manuales.**
- Sub-componentes: `PaginationContent`, `PaginationItem`, `PaginationLink` (`isActive`), `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`
- Usa `<nav>` con `aria-label` para accesibilidad

### ButtonGroup + ButtonGroupItem
Grupo de botones relacionados con estado activo.
- **active**: `boolean` — Resalta el botón

---

## Data

### Table
Tabla de datos con sorting.
- Sub-componentes: `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`
- `TableHead` acepta **sortDirection**: `'asc'` | `'desc'` | `false` | `undefined` y **onSort**: callback

### StatCard
Tarjeta de métrica con label, valor e ícono.
- **label**: `string`
- **value**: `string | number`
- **footer**: `ReactNode`
- **icon**: `ReactNode`
- **variant**: `'default'` | `'brand'` | `'success'` | `'danger'`
- **size**: `'default'` | `'sm'`

### Timeline
Visualización cronológica de eventos.
- Sub-componentes: `TimelineItem` (`size`: default/sm), `TimelineIcon` (`variant`: default/brand/success/danger), `TimelineContent`, `TimelineTitle`, `TimelineDescription`, `TimelineHeader`

### InlineConfirm
Confirmación inline para acciones destructivas.
- **onConfirm**: `() => void`
- **onCancel**: `() => void`
- **message**: `string` (default `'Are you sure?'`)

---

## Iconos y Utilidades

### DynamicIcon
Renderiza íconos Lucide por nombre o SVG inline.
- **icon**: `string` — Nombre de ícono Lucide (`'Settings'`, `'Search'`, `'Plus'`) o string SVG
- **size**: `number` (default 18)
- **color**: `string`
- Fallback a `HelpCircle` si no se encuentra

### useDebounce
Hook para debounce de valores.
```ts
const debouncedValue = UI.useDebounce(searchTerm, 300);
```

### cn
Utilidad para merge de clases CSS (clsx + tailwind-merge).
```ts
UI.cn('base-class', condition && 'conditional', variable)
```

---

## Design Tokens

Todos los componentes usan variables CSS del namespace `cg-*`. **Siempre** usar estos tokens en vez de colores Tailwind directos.

| Token | Uso |
|-------|-----|
| `cg-accent` | Color primario de acciones (teal) |
| `cg-brand` | Color de marca (gold) |
| `cg-text` / `cg-text-muted` / `cg-text-secondary` / `cg-text-subtle` | Jerarquía de texto |
| `cg-text-inverse` | Texto sobre fondo oscuro |
| `cg-bg` / `cg-bg-secondary` / `cg-bg-hover` / `cg-bg-active` | Fondos |
| `cg-border` / `cg-border-focus` / `cg-border-subtle` | Bordes |
| `cg-input-bg` / `cg-input-border` / `cg-input-placeholder` | Inputs |
| `cg-danger` / `cg-danger-hover` / `cg-danger-bg` / `cg-danger-border` | Errores/destructivo |
| `cg-success` / `cg-success-bg` / `cg-success-border` | Éxito |
| `cg-warning` / `cg-warning-text` / `cg-warning-bg` / `cg-warning-border` | Advertencias |
| `cg-skeleton` | Placeholder de carga |
| `cg-toggle-on` / `cg-toggle-off` | Switch/toggle |

> Todos los tokens tienen variantes light y dark mode automáticas.

---

## Patrones Comunes

| Necesito... | Usar | Ejemplo |
|-------------|------|---------|
| Botón de acción | `Button` con `variant` apropiado | `Button variant='destructive'` para eliminar |
| Mostrar estado/categoría | `Badge` | `Badge variant='success-soft'` para "Activo" |
| Imagen de usuario/entidad | `Avatar` con `name` o `icon` | `Avatar icon={emoji} size='md'` |
| Tag removible | `Chip` con `onRemove` | Selector con item seleccionado |
| Campo de tags múltiples | `ChipInput` | Alergias, etiquetas, categorías |
| Dropdown de selección | `Select` + `SelectItem` | Filtros, campos de formulario |
| Modal de formulario | `FormDialog` | Crear/editar entidades |
| Modal multi-paso | `StepDialog` | Wizards, onboarding |
| Tabla con sorting | `Table` + `TableHead` con `sortDirection` | Listados principales |
| Paginación | `Pagination` + sub-componentes | Debajo de tablas/listas |
| Filtros agrupados | `ButtonGroup` + `ButtonGroupItem` | Filtro por especie, estado |
| Loading en página | `LoadingOverlay` `variant='skeleton'` | Carga inicial de vista |
| Loading en dropdown | `LoadingOverlay` `inline variant='dots'` | Búsqueda server-side |
| Sin resultados | `EmptyState` | Tablas/listas vacías |
| Error con retry | `ErrorDisplay` con `onRetry` | Fallos de API |
| Métricas/KPIs | `StatCard` | Dashboard, resúmenes |
| Historial | `Timeline` | Eventos cronológicos |
| Confirmar eliminación | `InlineConfirm` | Eliminar inline en tablas |
| Alerta/warning visual | `Card` + tokens `cg-warning-*` | Alertas médicas, avisos |
| Panel lateral | `Sheet` | Detalles, formularios rápidos |
| Info al hover | `Tooltip` | Explicaciones, atajos |
