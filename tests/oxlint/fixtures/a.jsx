import React from 'react';
import Foo from './foo';

const a = 1;
function Comp() {
    const x = {};
    return <Foo bar={x} onClick={() => a == 1} />;
}
export default Comp;
