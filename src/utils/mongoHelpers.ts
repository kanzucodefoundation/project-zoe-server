export const inArray = (array: any[], data: any, field: string) => {
    return array.some(it => it[field] === data[field]);
};

export const cleanUpId = ({_id, ...rest}: any) => {
    return {id: _id, ...rest};
};

export const updateDocument = (doc: any, update: any) => {
    for (const key in update) {
        if (update.hasOwnProperty(key))
            doc[key] = update[key];
    }
};
