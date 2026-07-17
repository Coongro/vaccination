---
'@coongro/vaccination': patch
---

fix(settings): quita las settings de hora/duración de próxima dosis

`nextDoseDefaultTime` (un enum de 21 horas fijas 08:00–18:00 — un time picker disfrazado que además ignoraba el horario real de la agenda) y `nextDoseDefaultDuration` (que redefinía la duración de franja que ya define `appointments.agenda.slotMinutes`) se **eliminan**. El diálogo de próxima dosis usa prefills fijos (09:00 / 15 min) que el veterinario ajusta con el TimePicker + la sugerencia de slot libre que ya existe. Se mantiene `nextDoseAppointment` (off/ask/auto). Migra la capa de settings al Builder.
