import logger from "../utils/logging/logger";
import {seedUsersAsync} from "./seed.users";
import {createGroups} from "./seed.groups";

export async function seedDataAsync() {
    try {
        await seedUsersAsync();
        await createGroups();
    } catch (e) {
        logger.error(e);
    }
}

