import morgan, {StreamOptions} from 'morgan'
import logger from "./logger";

let stream: StreamOptions = {
    write(message: string): void {
        logger.info(message.substring(0, message.lastIndexOf('\n')))
    }
};
export default morgan('dev', {stream});
