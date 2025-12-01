import { styleText, inspect } from 'node:util';

type Format = Parameters<typeof styleText>[0];
type Styles<F extends Format> = F extends unknown[] ? never : F;
type Style = Styles<Format>;

const inspectStyles = Object.keys(inspect.colors) as Style[];

export const style = Object.fromEntries(
  inspectStyles.map((styleName) => {
    return [styleName, styleText.bind(undefined, styleName)];
  }),
) as Record<Style, (text: string) => string>;
