import * as helpers from './helpers';

export default function Page() {
  const Widget = helpers.SomethingElse;
  return <div>{Widget()}</div>;
}
