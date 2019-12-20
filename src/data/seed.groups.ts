import GroupCategoryModel from "../modules/groups/categories/groupcategory.model";
import logger from "../utils/logging/logger";

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
]

export async function createGroupCategories() {
    const data = await GroupCategoryModel.find({}).exec()
    if(data.length==0){
        logger.info('Creating group categories')
        const resp = await GroupCategoryModel.create(groupCategories)
        logger.info(`Created  ${resp.length} group categories`, resp)
    }else{
        logger.info('Group categories already seeded')
    }
}
