export type AppRole = "manager" | "employee";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  password: string;
};

export type PublicUser = Omit<AppUser, "password">;

export const managerUser: AppUser = {
  id: "u-manager-1",
  name: "Sarah Manager",
  email: "sarah@crystalgroup.com",
  role: "manager",
  password: "manager123",
};

export const employeeUsers: AppUser[] = [
  {
    id: "u-emp-1",
    name: "Aisha Patel",
    email: "aisha@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-2",
    name: "Rahul Mehta",
    email: "rahul@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-3",
    name: "Neha Singh",
    email: "neha@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-4",
    name: "Arjun Nair",
    email: "arjun@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-5",
    name: "Priya Sharma",
    email: "priya@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-6",
    name: "Vikram Joshi",
    email: "vikram@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-7",
    name: "Kavya Reddy",
    email: "kavya@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-8",
    name: "Rohan Das",
    email: "rohan@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-9",
    name: "Meera Iyer",
    email: "meera@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-10",
    name: "Aman Verma",
    email: "aman@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-11",
    name: "Sneha Kapoor",
    email: "sneha@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-12",
    name: "Dev Malhotra",
    email: "dev@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-13",
    name: "Pooja Arora",
    email: "pooja@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-14",
    name: "Nikhil Rao",
    email: "nikhil@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-15",
    name: "Ishita Bose",
    email: "ishita@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-16",
    name: "Tanvi Gupta",
    email: "tanvi@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-17",
    name: "Karan Sethi",
    email: "karan@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-18",
    name: "Ritika Jain",
    email: "ritika@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-19",
    name: "Harsh Kulkarni",
    email: "harsh@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
  {
    id: "u-emp-20",
    name: "Simran Chawla",
    email: "simran@crystalgroup.com",
    role: "employee",
    password: "employee123",
  },
];

export const allUsers = [managerUser, ...employeeUsers];

export function sanitizeUser(user: AppUser): PublicUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function getSafeUsers(): PublicUser[] {
  return allUsers.map(sanitizeUser);
}

export function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return allUsers.find(
    (user) => user.email.toLowerCase() === normalizedEmail && user.password === password,
  );
}
