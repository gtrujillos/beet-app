// Mentor and Appointment Repository (repositories/mentorAgendaRepository.js)
// --------------------------------------------------
// This file handles database operations related to mentors and appointments.

import { getDbConnection, getDbConnectionAppointment } from "../services/dbConnection.js";

export class MentorAgendaRepository {
  async getAllMentors() {
    try {
      const client = await getDbConnectionAppointment();
      const query = `SELECT id, "Nombre", created_at, updated_at, created_by, updated_by, "Telefono", "Profesion", disp_lunes, "Correo_electronico", nc_i3jc___lineas_atencion_id, "Calendario"
                    FROM public.nc_i3jc___mentores;`;
      const res = await client.query(query);
      client.release();
      return res.rows;
    } catch (err) {
      console.error("Error fetching mentors", err);
      throw err;
    }
  }

  async getAllAppointments() {
    try {
      const client = await getDbConnectionAppointment();
      const query = `SELECT id, id_ticket_cliente, created_at, updated_at, created_by, updated_by, estado, tipo_novedad, notas, fecha_agenda, nc_i3jc___mentores_id, nc_i3jc___lineas_atencion_id, nombre_completo, telefono, correo_electronico, intentos_contacto, link_agenda, programa_sesion
                    FROM public."nc_i3jc___Agendamientos";`;
      const res = await client.query(query);
      client.release();
      return res.rows;
    } catch (err) {
      console.error("Error fetching appointments", err);
      throw err;
    }
  }

  async getAppointmentsByPhone(phone) {
    try {
      const client = await getDbConnectionAppointment();
      const query = `SELECT id, id_ticket_cliente, created_at, updated_at, created_by, updated_by, estado, tipo_novedad, notas, fecha_agenda, nc_i3jc___mentores_id, nc_i3jc___lineas_atencion_id, nombre_completo, telefono, correo_electronico, intentos_contacto, link_agenda, programa_sesion
                    FROM public."nc_i3jc___Agendamientos"
                    WHERE telefono = $1;`;
      const res = await client.query(query, [phone]);
      client.release();
      return res.rows;
    } catch (err) {
      console.error("Error fetching appointments by telefono", err);
      throw err;
    }
  }
}
