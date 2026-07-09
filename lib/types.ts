export type ServiceDto = {
  id: string;
  name: string;
  durationMinutes: number;
};

export type BookingDto = {
  id: string;
  employeeId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status?: "confirmed" | "cancelled" | "completed" | "no_show";
  notes?: string | null;
  service: ServiceDto;
  employee: {
    id: string;
    name: string;
  };
};

export type WorkingHoursDto = {
  id: string;
  employeeId: string;
  weekStartDate: string;
  date: string;
  weekday: number;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
};
