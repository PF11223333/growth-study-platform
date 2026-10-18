export function routeHash(path,params={}){
 const value=String(path).replace(/^#?\//,'');const separator=value.indexOf('?');
 const pathname=separator<0?value:value.slice(0,separator),query=separator<0?'':value.slice(separator+1);
 const values=new URLSearchParams(query);for(const [key,value]of Object.entries(params))values.set(key,value);
 const qs=values.toString();return `#/${pathname}${qs?'?'+qs:''}`;
}
