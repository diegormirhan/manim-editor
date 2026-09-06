declare const validate: ((project: unknown) => boolean) & {
  errors?: { message?: string }[] | null;
};
export default validate;
