import { Gender } from "../../crm/enums/gender";

interface SeedSalvationRecordDto {
  fullName: string;
  phoneNumber: string;
  email?: string;
  address: string;
  dateOfSalvation: Date;
  serviceOrEvent: string;
  gender?: Gender;
}

export const seedSalvationRecords: SeedSalvationRecordDto[] = [
  {
    fullName: "James Mukasa",
    phoneNumber: "0701234567",
    email: "james.mukasa@example.com",
    address: "Kampala Central",
    dateOfSalvation: new Date("2024-01-15"),
    serviceOrEvent: "Sunday Service",
    gender: Gender.Male,
  },
  // Intentional duplicate to test matching
  {
    fullName: "James Mukasa",
    phoneNumber: "0701234567",
    email: "james.m@example.com",
    address: "Ntinda",
    dateOfSalvation: new Date("2024-02-20"),
    serviceOrEvent: "Revival Meeting",
    gender: Gender.Male,
  },
  {
    fullName: "Sarah Namukasa",
    phoneNumber: "0772345678",
    email: "sarah.n@example.com",
    address: "Bukoto",
    dateOfSalvation: new Date("2024-03-01"),
    serviceOrEvent: "Youth Conference",
    gender: Gender.Female,
  },
  {
    fullName: "David Okiror",
    phoneNumber: "0753456789",
    address: "Nakawa",
    dateOfSalvation: new Date("2024-03-05"),
    serviceOrEvent: "Sunday Service",
    gender: Gender.Male,
  },
  {
    fullName: "Grace Atim",
    phoneNumber: "0784567890",
    email: "grace.a@example.com",
    address: "Kololo",
    dateOfSalvation: new Date("2024-03-10"),
    serviceOrEvent: "Women's Conference",
    gender: Gender.Female,
  },
  // Another duplicate set
  {
    fullName: "Peter Okello",
    phoneNumber: "0795678901",
    address: "Wandegeya",
    dateOfSalvation: new Date("2024-03-15"),
    serviceOrEvent: "Sunday Service",
    gender: Gender.Male,
  },
  {
    fullName: "Peter Okello",
    phoneNumber: "0795678901",
    address: "Makerere",
    dateOfSalvation: new Date("2024-03-20"),
    serviceOrEvent: "Home Cell",
    gender: Gender.Male,
  },
  {
    fullName: "Ruth Nabatanzi",
    phoneNumber: "0706789012",
    email: "ruth.n@example.com",
    address: "Mengo",
    dateOfSalvation: new Date("2024-03-25"),
    serviceOrEvent: "Easter Service",
    gender: Gender.Female,
  },
  {
    fullName: "Samuel Wasswa",
    phoneNumber: "0777890123",
    address: "Rubaga",
    dateOfSalvation: new Date("2024-03-30"),
    serviceOrEvent: "Sunday Service",
    gender: Gender.Male,
  },
  {
    fullName: "Joy Aceng",
    phoneNumber: "0758901234",
    email: "joy.a@example.com",
    address: "Nsambya",
    dateOfSalvation: new Date("2024-04-01"),
    serviceOrEvent: "Prayer Meeting",
    gender: Gender.Female,
  },
];
