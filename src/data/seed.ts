import logger from "../utils/logging/logger";
import {seedUsersAsync} from "./seed.users";

export async function seedDataAsync() {
    try {
        await seedUsersAsync();
        //await createGroupCategories()
    } catch (e) {
        logger.error(e);
    }
}

