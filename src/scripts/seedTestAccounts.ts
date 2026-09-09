// Comprehensive test fixtures: two locations of the same type (so
// location-scoping is actually exercised) plus two employee accounts per
// existing role, each with a working employeeCode + PIN for logging in and
// testing the system end-to-end. Idempotent — safe to re-run.
import type { LocationType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashSecret } from "../lib/hash.js";

const tenant = await prisma.tenant.findFirstOrThrow({ where: { slug: "hotelier-demo" } });

const TEST_PIN = "1234";

async function upsertLocation(name: string, type: LocationType, sell: { canSellRooms?: boolean; canSellMenu?: boolean; canSellServices?: boolean; canSellProducts?: boolean } = {}) {
  return prisma.location.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name } },
    update: {},
    create: { tenantId: tenant.id, name, type, ...sell },
  });
}

// Two Reception-type locations so two receptionists can each be pinned to a
// distinct front desk, and one Shop so the Products POS has a natural
// dedicated retail home distinct from Reception.
const receptionTwo = await upsertLocation("Reception Two", "RECEPTION");
await upsertLocation("Gift Shop", "SHOP", { canSellRooms: false, canSellMenu: false, canSellServices: false, canSellProducts: true });

const receptionOne = await prisma.location.findFirst({ where: { tenantId: tenant.id, type: "RECEPTION", id: { not: receptionTwo.id } } });
const restaurant = await prisma.location.findFirst({ where: { tenantId: tenant.id, type: "RESTAURANT" } });
const barLounge = await prisma.location.findFirst({ where: { tenantId: tenant.id, type: "BAR" } });
const mainStore = await prisma.location.findFirst({ where: { tenantId: tenant.id, type: "STORE" } });

const roles = await prisma.role.findMany({ where: { tenantId: tenant.id } });
const roleId = (name: string) => roles.find((r) => r.name === name)?.id;

const departments = await prisma.department.findMany({ where: { tenantId: tenant.id } });
// "SERVICE_CENTER" -> "Service Center", "SALES" -> "Sales"
const deptId = (planDept: string) => {
  const name = planDept.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
  const found = departments.find((d) => d.name === name);
  if (!found) throw new Error(`Department "${name}" is not seeded for this tenant — start the API once so provisionTenantBootstrap creates the default set.`);
  return found.id;
};

type Plan = {
  role: string;
  department: "RECEPTION" | "HOUSEKEEPING" | "KITCHEN" | "SALES" | "SERVICE_CENTER" | "INVENTORY" | "FINANCE" | "MANAGEMENT" | "MAINTENANCE" | "SECURITY";
  jobTitle: string;
  people: { code: string; firstName: string; lastName: string; phone: string; locationId?: string | null }[];
};

const plans: Plan[] = [
  { role: "Receptionist", department: "RECEPTION", jobTitle: "Receptionist", people: [
    { code: "RECEP1", firstName: "Grace", lastName: "Wanjiru", phone: "0711000001", locationId: receptionOne?.id },
    { code: "RECEP2", firstName: "Peter", lastName: "Otieno", phone: "0711000002", locationId: receptionTwo.id },
  ] },
  { role: "Waiter", department: "SALES", jobTitle: "Waiter", people: [
    { code: "WAITER1", firstName: "Faith", lastName: "Njeri", phone: "0711000003", locationId: restaurant?.id },
    { code: "WAITER2", firstName: "Brian", lastName: "Kiptoo", phone: "0711000004", locationId: barLounge?.id },
  ] },
  { role: "Chef", department: "KITCHEN", jobTitle: "Chef", people: [
    { code: "CHEF1", firstName: "Samuel", lastName: "Mwangi", phone: "0711000005" },
    { code: "CHEF2", firstName: "Ann", lastName: "Wambui", phone: "0711000006" },
  ] },
  { role: "Housekeeping", department: "HOUSEKEEPING", jobTitle: "Housekeeping Attendant", people: [
    { code: "HSKP1", firstName: "Josephine", lastName: "Achieng", phone: "0711000007" },
    { code: "HSKP2", firstName: "David", lastName: "Kamau", phone: "0711000008" },
  ] },
  { role: "Storekeeper", department: "INVENTORY", jobTitle: "Storekeeper", people: [
    { code: "STORE1", firstName: "John", lastName: "Mutua", phone: "0711000009", locationId: mainStore?.id },
    { code: "STORE2", firstName: "Lucy", lastName: "Chebet", phone: "0711000010", locationId: mainStore?.id },
  ] },
  { role: "Accountant", department: "FINANCE", jobTitle: "Accountant", people: [
    { code: "ACCT1", firstName: "Mercy", lastName: "Wairimu", phone: "0711000011" },
    { code: "ACCT2", firstName: "Kevin", lastName: "Omondi", phone: "0711000012" },
  ] },
  { role: "Manager", department: "MANAGEMENT", jobTitle: "Manager", people: [
    { code: "MGR1", firstName: "Susan", lastName: "Adhiambo", phone: "0711000013" },
    { code: "MGR2", firstName: "Daniel", lastName: "Kiprotich", phone: "0711000014" },
  ] },
  { role: "Super Admin", department: "MANAGEMENT", jobTitle: "Super Admin", people: [
    { code: "ADMIN1", firstName: "Alice", lastName: "Nyambura", phone: "0711000015" },
    { code: "ADMIN2", firstName: "Moses", lastName: "Kariuki", phone: "0711000016" },
  ] },
];

const hashedPin = hashSecret(TEST_PIN);
const dateHired = new Date();

for (const plan of plans) {
  const rid = roleId(plan.role);
  for (const person of plan.people) {
    const locations = person.locationId ? { set: [{ id: person.locationId }] } : { set: [] };
    await prisma.employee.upsert({
      where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: person.code } },
      update: { roleId: rid, locations, departmentId: deptId(plan.department), jobTitle: plan.jobTitle },
      create: {
        tenantId: tenant.id,
        employeeCode: person.code,
        pin: hashedPin,
        firstName: person.firstName,
        lastName: person.lastName,
        phone: person.phone,
        departmentId: deptId(plan.department),
        jobTitle: plan.jobTitle,
        dateHired,
        salaryAmount: 30000,
        roleId: rid,
        locations: person.locationId ? { connect: [{ id: person.locationId }] } : undefined,
        status: "ACTIVE",
      },
    });
  }
}

console.log(`Seeded ${plans.reduce((n, p) => n + p.people.length, 0)} test employees across ${plans.length} roles. PIN for all: ${TEST_PIN}`);
await prisma.$disconnect();
