---
'@coongro/vaccination': minor
---

feat(vacunación): recordatorio de refuerzo in-app para el equipo (COONG-253)

Nueva setting `vaccination.doseReminder` (sin recordatorio / 1 / 3 / 7 días antes). Al registrar una aplicación con fecha de próxima dosis, agenda un aviso en la campana de Coongro para el equipo de la clínica unos días antes del refuerzo (por-tenant, no llega al tutor), usando el motor de notificaciones agendadas (COONG-166). Default off. Como una aplicación es inmutable (sin edit/delete), solo se agenda al aplicar — no hay cancelación/reprogramación. Distinto de `nextDoseAppointment` (que agenda el turno).
