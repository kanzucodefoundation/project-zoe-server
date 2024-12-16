import { User } from "./entities/user.entity";
import Roles from "./entities/roles.entity";
import UserRoles from "./entities/userRoles.entity";
import { SalvationRecord } from "../../src/crm/entities/salvation.entity";

export const usersEntities = [User, UserRoles, Roles, SalvationRecord];
