export const indent = (text: string, indentation = '  ') => {
  return `${indentation}${text.split('\n').join(`\n${indentation}`)}`;
};
