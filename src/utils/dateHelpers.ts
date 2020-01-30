import {isValid, parseISO} from "date-fns";

export const isValidDate = (str: string): boolean => {
    try {
        return isValid(parseISO(str));
    } catch (e) {
        return false;
    }
};

export const strToDate = (str: string): Date | null => {
    try {
        return parseISO(str);
    } catch (e) {
        return null;
    }
};
