import * as service from "../modules/groups/services/group.service";
import logger from "../utils/logging/logger";
import {getRepository} from "typeorm";
import {GroupCategory} from "../modules/groups/entities/GroupCategory";

const groupCategories = [
    {
        name: "Location",
        details: "Church Location"
    },
    {
        name: "Cohort",
        details: "Group of Mcs"
    },
    {
        name: "MC",
        details: "Missional Community"
    }
];

const groupCatRepo = () => getRepository(GroupCategory);

export async function createGroupCategories() {
    const data = await service.searchAsync({});
    if(data.length==0){
        logger.info("Creating group categories");
        for (const it of groupCategories) {
            await groupCatRepo().save(it);
        }
        logger.info(`Created  ${groupCategories.length} group categories`);
    }else{
        logger.info("Group categories already seeded");
    }
}
