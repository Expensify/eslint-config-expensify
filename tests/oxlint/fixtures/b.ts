import {useEffect} from 'react';
const value: Record<string, string> = {};
export function f() {
    useEffect(() => { console.log(value.a); }, [value.b]);
    return value['a'];
}
