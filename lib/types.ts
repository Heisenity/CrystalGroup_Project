export type Review = {
  timestamp: string;
  monthKey: string;
  employeeEmail: string;
  employeeName: string;
  managerEmail: string;
  outputQuality: number;
  attendance: number;
  teamwork: number;
  comment: string;
};

export type ReviewPayload = Omit<Review, "timestamp" | "monthKey">;
