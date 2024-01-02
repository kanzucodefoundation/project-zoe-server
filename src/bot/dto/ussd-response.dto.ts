export enum ChatAction {
  Prompt = 0,
  End = 1,
}

export class UssdResponseDto {
  action: ChatAction;
  text: string;
}
