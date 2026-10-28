import React from'react';import{createRoot}from'react-dom/client';import App from'./App';import './styles.css';import './workspace.css';
function reloadLatest(){const target=new URL(location.href);target.searchParams.set('refresh',String(Date.now()));location.replace(target.href);}
window.addEventListener('vite:preloadError',()=>{
 if(!navigator.onLine)return;
 try{const last=Number(sessionStorage.getItem('growth-module-recovery')||0);if(Date.now()-last<60000)return;sessionStorage.setItem('growth-module-recovery',String(Date.now()));reloadLatest();}catch{/* Keep the explicit recovery button available if storage is disabled. */}
});
class PageRecovery extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="page-recovery" role="alert"><h1>这一页暂时没有打开</h1><p>网站更新或网络中断可能影响页面加载。已保存的练习和笔记仍保留在当前设备。</p><button className="button primary" onClick={reloadLatest}>重新载入当前页</button><button className="button outline" onClick={()=>{const target=new URL(location.href);target.hash='/today';target.searchParams.set('refresh',String(Date.now()));location.replace(target.href);}}>回到学习工作台</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><PageRecovery><App/></PageRecovery></React.StrictMode>);
