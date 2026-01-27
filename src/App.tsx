import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, Users, FileText, Clock, CheckCircle, XCircle, 
  Server, ChevronRight, ChevronDown, LogOut, Lock, User, 
  Bird, Activity, ShieldAlert, Calendar, Hash, UserPlus, Crown,
  ShieldCheck, ClipboardList, List, Zap, Mail, Search, Filter
} from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import './App.css';

// --- CONFIGURAÇÃO ---
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

const LEADER_KEYWORDS = ['Líder', 'Head', 'Tech Lead', 'Coordenador', 'Gerente', 'Gestor', 'Diretor', 'CTO', 'CEO', 'Super Admin'];
const DEPT_ORDER = [
  'Board', 'Lideranças & Gestão', 'Tecnologia e Segurança', 'Produto', 
  'Produto 3C+', 'Produto Evolux', 'Produto FiqOn', 'Produto Dizify',
  'Comercial', 'Comercial Contact', 'Marketing', 'Atendimento ao Cliente', 
  'Pessoas e Cultura', 'Administrativo'
];

// --- INTERFACES ---
interface User { 
  id: string; name: string; email: string;
  role?: { name: string }; department?: { name: string }; 
  manager?: { id: string; name: string; };
  myDeputy?: { id: string; name: string; };
}
interface Tool { id: string; name: string; owner?: { name: string }; subOwner?: { name: string }; }
interface Request { id: string; requesterId: string; requester: User; type: string; status: string; details: string; justification: string; createdAt: string; updatedAt: string; isExtraordinary: boolean; lastApprover?: { name: string }; }
interface Department { id: string; name: string; roles: Role[]; }
interface Role { id: string; name: string; users: User[]; }

type SystemProfile = 'SUPER_ADMIN' | 'ADMIN' | 'APPROVER' | 'VIEWER';

// --- COMPONENTES AUXILIARES ---
const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'APROVADO') return <span className="badge APROVADO">APROVADO</span>;
  if (status === 'REPROVADO') return <span className="badge REPROVADO">REPROVADO</span>;
  
  let label = 'PENDENTE';
  let colorClass = 'PENDENTE';
  
  if (status === 'PENDENTE_GESTOR') label = 'AGUARD. GESTOR';
  if (status === 'PENDENTE_OWNER') { label = 'AGUARD. OWNER'; colorClass = 'PENDENTE_OWNER'; }
  if (status === 'PENDENTE_SUB_OWNER') { label = 'AGUARD. SUB-OWNER'; colorClass = 'PENDENTE_OWNER'; }
  if (status === 'PENDENTE_SI') { label = 'AGUARD. SI (SEGURANÇA)'; colorClass = 'PENDENTE_SI'; }

  return <span className={`badge ${colorClass}`}>{label}</span>;
};

const ActivityFeed = ({ requests }: { requests: Request[] }) => (
  <div className="glass-card" style={{height: '100%', minHeight: '400px'}}>
    <h3 style={{marginBottom:'20px', display:'flex', alignItems:'center', gap:'10px'}}>
      <Activity size={20} color="#0ea5e9"/> Atividade Recente
    </h3>
    <div className="activity-list">
      {requests.slice(0, 6).map(r => {
        let info = "Detalhes indisponíveis";
        try { const parsed = JSON.parse(r.details); info = parsed.info || info; } catch (e) {}

        return (
          <div key={r.id} className="activity-item">
            <div className={`status-indicator ${r.status}`}></div>
            <div>
              <div className="act-title">
                <span style={{color:'#cbd5e1'}}>{r.requester?.name.split(' ')[0]}</span> - {info}
              </div>
              <div className="act-date">
                {new Date(r.createdAt).toLocaleDateString()} • {r.status.replace('PENDENTE_', 'AGUARD. ')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [systemProfile, setSystemProfile] = useState<SystemProfile>('VIEWER');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [expandedDepts, setExpandedDepts] = useState<string[]>([]);
  
  const [structure, setStructure] = useState<Department[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);

  // Estados de Formulário e Filtros
  const [targetUserId, setTargetUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // --- CARREGAMENTO DE DADOS ---
  const loadData = async () => {
    try {
      const [resStruct, resTools, resUsers, resReqs] = await Promise.all([
        fetch(`${API_URL}/api/structure`), fetch(`${API_URL}/api/tools`), fetch(`${API_URL}/api/users`), fetch(`${API_URL}/api/solicitacoes`)
      ]);
      const rawStruct = await resStruct.json();
      const dUsers = await resUsers.json();
      const dTools = await resTools.json();
      const dReqs = await resReqs.json();

      const finalStructure: Department[] = [];
      const leadershipRoles: Role[] = [];
      const boardDept = rawStruct.find((d: any) => d.name === 'Board');
      if (boardDept) finalStructure.push(boardDept);

      rawStruct.filter((d: any) => d.name !== 'Board').forEach((dept: any) => {
        const leaders = dept.roles.filter((r: any) => LEADER_KEYWORDS.some(k => r.name.includes(k)));
        const staff = dept.roles.filter((r: any) => !LEADER_KEYWORDS.some(k => r.name.includes(k)));
        if (leaders.length > 0) leaders.forEach((l: any) => leadershipRoles.push({ ...l, name: `${l.name} (${dept.name})` }));
        if (staff.length > 0) finalStructure.push({ ...dept, roles: staff });
      });

      if (leadershipRoles.length > 0) finalStructure.push({ id: 'liderancas-virtual-id', name: 'Lideranças & Gestão', roles: leadershipRoles });

      finalStructure.sort((a, b) => {
        let idxA = DEPT_ORDER.indexOf(a.name); let idxB = DEPT_ORDER.indexOf(b.name);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      setStructure(finalStructure); setTools(dTools); setAllUsers(dUsers); setRequests(dReqs);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadData();
    const intervalId = setInterval(() => { if (isLoggedIn) loadData(); }, 5000);
    return () => clearInterval(intervalId);
  }, [isLoggedIn]);

  // --- HANDLERS ---
  const responseGoogle = async (credentialResponse: any) => {
    try {
      const res = await fetch(`${API_URL}/api/login/google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential, clientId: credentialResponse.clientId })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user); setSystemProfile(data.profile); setIsLoggedIn(true); setActiveTab('DASHBOARD');
      } else { alert(`❌ Acesso Negado: ${data.error}`); }
    } catch (error) { alert("Falha de conexão."); }
  };

  const handleLogout = () => { setIsLoggedIn(false); setCurrentUser(null); setSystemProfile('VIEWER'); };

  const handleDeputyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !targetUserId) return;
    const deputy = allUsers.find(u => u.id === targetUserId);
    const details = { info: `Nomeação de Deputy: ${deputy?.name}`, targetUserId };
    await fetch(`${API_URL}/api/solicitacoes`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ requesterId: currentUser.id, type: 'NOMINATE_DEPUTY', details, justification: 'Indicação via Painel', isExtraordinary: false })
    });
    alert("Solicitação de Deputy enviada!"); setTargetUserId(''); loadData();
  };

  const handleApprove = async (id: string, action: 'APROVAR' | 'REPROVAR') => {
    if (!confirm(`Tem certeza que deseja ${action} esta solicitação?`)) return;
    const res = await fetch(`${API_URL}/api/solicitacoes/${id}`, {
      method: 'PATCH', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ status: action, approverId: currentUser?.id })
    });
    if(res.ok) { loadData(); } else { alert(`❌ Erro na operação.`); }
  };

  // Lógica de Filtros (Auditoria)
  const getFilteredHistory = () => {
    return requests.filter(r => {
      if (!['APROVADO', 'REPROVADO'].includes(r.status)) return false;
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
      if (filterDate) {
        const reqDate = new Date(r.updatedAt).toISOString().split('T')[0];
        if (reqDate !== filterDate) return false;
      }
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        let info = ''; try { info = JSON.parse(r.details).info } catch (e) {}
        const matches = 
          r.requester?.name.toLowerCase().includes(lowerSearch) ||
          r.requester?.email.toLowerCase().includes(lowerSearch) ||
          r.id.toLowerCase().includes(lowerSearch) ||
          info.toLowerCase().includes(lowerSearch);
        if (!matches) return false;
      }
      return true;
    });
  };

  // --- TELA DE LOGIN IMERSIVA ---
  if (!isLoggedIn) return (
      <div className="login-wrapper">
        <div className="ambient-background">
           <div className="cloud cloud-1"></div>
           <div className="cloud cloud-2"></div>
        </div>
        
        <div className="login-content-layer">
            <div className="login-brand-side">
                <div className="brand-logo-box"><Bird size={48} color="#0ea5e9" strokeWidth={2}/></div>
                <h1 className="brand-title">THERIS <span className="os-badge">OS</span></h1>
                <p className="brand-subtitle">Identity Governance & Intelligence</p>
                <div className="brand-features">
                    <div className="feat-item"><ShieldCheck size={18} color="#0ea5e9"/> <span>Segurança Zero-Trust</span></div>
                    <div className="feat-item"><Zap size={18} color="#0ea5e9"/> <span>Automação em Tempo Real</span></div>
                </div>
            </div>

            <div className="login-form-side">
                <div className="login-glass-card">
                    <div className="login-header">
                        <h2>Bem-vindo de volta</h2>
                        <p>Faça login com sua conta corporativa</p>
                    </div>
                    <div className="google-btn-wrapper">
                        <GoogleLogin onSuccess={responseGoogle} onError={() => alert('Falha no Login')} theme="filled_black" shape="pill" size="large" text="continue_with" width="100%"/>
                    </div>
                    <div className="login-footer">
                        <Lock size={14} /> Ambiente Seguro & Monitorado
                    </div>
                </div>
            </div>
        </div>
        <div className="login-footer-global">
            <span>SYS.STATUS: <span style={{color:'#10b981'}}>ONLINE</span></span>
            <span>ENCRYPT: <span style={{color:'#0ea5e9'}}>TLS 1.3</span></span>
        </div>
      </div>
  );

  // --- APP PRINCIPAL ---
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand-box"><div className="icon-wrapper"><Bird size={28} color="#0ea5e9" /></div><span className="brand-text">THERIS</span></div>
        <div className="user-mini-profile">
          <div className="avatar">{currentUser?.name ? currentUser.name.charAt(0) : 'U'}</div>
          <div className="info"><div className="name">{currentUser?.name?.split(' ')[0]}</div><div className="role">{systemProfile}</div></div>
        </div>
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'DASHBOARD' ? 'active' : ''}`} onClick={() => setActiveTab('DASHBOARD')}><div className="icon-wrapper"><LayoutDashboard size={20} /></div><span className="nav-text">Visão Geral</span></div>
          {(systemProfile === 'ADMIN' || systemProfile === 'SUPER_ADMIN') && (
            <>
              <div className={`nav-item ${activeTab === 'HISTORY' ? 'active' : ''}`} onClick={() => setActiveTab('HISTORY')}><div className="icon-wrapper"><FileText size={20} /></div><span className="nav-text">Auditoria</span></div>
              <div className={`nav-item ${activeTab === 'ORG' ? 'active' : ''}`} onClick={() => setActiveTab('ORG')}><div className="icon-wrapper"><Users size={20} /></div><span className="nav-text">Organograma</span></div>
              <div className={`nav-item ${activeTab === 'TOOLS' ? 'active' : ''}`} onClick={() => setActiveTab('TOOLS')}><div className="icon-wrapper"><Server size={20} /></div><span className="nav-text">Ferramentas</span></div>
            </>
          )}
        </nav>
        <button onClick={handleLogout} className="logout-btn"><div className="icon-wrapper"><LogOut size={20}/></div><span className="nav-text">Sair</span></button>
      </aside>

      <main className="main-area">
        <header className="header-bar">
           <div><div style={{background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)', padding: '6px 14px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px'}}><h2 style={{color: '#0ea5e9', fontSize:'1rem', margin: 0, fontWeight: 600}}>Painel / {activeTab}</h2></div><div style={{color:'#94a3b8', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:'5px', marginTop:'6px', paddingLeft:'4px'}}><Calendar size={12}/> {today}</div></div>
           <div className="status-badge"><div className="dot"></div> Sistema Operante</div>
        </header>

        <div className="content-scroll">
          {activeTab === 'DASHBOARD' && (
            <div className="dashboard-grid">
               <div className="hero-banner">
                 <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
                   <div style={{width:'60px', height:'60px', borderRadius:'50%', background:'linear-gradient(135deg, #0ea5e9, #3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', fontWeight:'bold', color:'#fff'}}>{currentUser?.name.charAt(0)}</div>
                   <div><h1>Olá, <span style={{color:'#0ea5e9'}}>{currentUser?.name?.split(' ')[0]}</span></h1><p style={{color:'#94a3b8'}}>{currentUser?.role?.name} • {currentUser?.department?.name}</p></div>
                 </div>
               </div>
               <div className="stats-container">
                 <div className="glass-card"><div className="stat-label">Minhas Solicitações</div><div className="stat-value">{requests.filter(r=>r.requesterId === currentUser?.id).length}</div></div>
                 <div className="glass-card"><div className="stat-label">Pendentes</div><div className="stat-value" style={{color:'#f59e0b'}}>{requests.filter(r=>r.status.includes('PENDENTE')).length}</div></div>
                 <div className="glass-card"><div className="stat-label">Processadas</div><div className="stat-value" style={{color:'#10b981'}}>{requests.filter(r=>['APROVADO','REPROVADO'].includes(r.status)).length}</div></div>
               </div>
               <div className="dashboard-split">
                  <div className="left-panel-stack" style={{display:'flex', flexDirection:'column', gap:'20px', flex: 2}}>
                      {systemProfile !== 'VIEWER' && (
                        <div className="glass-card">
                           <h3 style={{marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px'}}><Clock size={20} color="#f59e0b"/> Aprovações Pendentes</h3>
                           <table className="modern-table"><thead><tr><th>Solicitante</th><th>Pedido</th><th>Status</th><th style={{textAlign:'right'}}>Ação</th></tr></thead><tbody>{requests.filter(r=> r.status.includes('PENDENTE')).slice(0, 5).map(r => (<tr key={r.id}><td style={{fontWeight:500}}>{r.requester?.name}</td><td style={{color:'#cbd5e1', fontSize:'0.85rem'}}>Detalhes...</td><td><StatusBadge status={r.status}/></td><td style={{textAlign:'right'}}><div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}><button onClick={()=>handleApprove(r.id,'APROVAR')} className="btn-icon btn-approve"><CheckCircle size={18}/></button><button onClick={()=>handleApprove(r.id,'REPROVAR')} className="btn-icon btn-reject"><XCircle size={18}/></button></div></td></tr>))}</tbody></table>
                        </div>
                      )}
                      <div className="glass-card"><h3 style={{marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px'}}><List size={20} color="#0ea5e9"/> Minhas Solicitações Recentes</h3><table className="modern-table"><thead><tr><th>Data</th><th>Tipo</th><th>Status</th></tr></thead><tbody>{requests.filter(r => r.requesterId === currentUser?.id).slice(0,5).map(r => (<tr key={r.id}><td>{new Date(r.createdAt).toLocaleDateString()}</td><td>{r.type === 'ACCESS_TOOL' ? 'Acesso Ferramenta' : r.type}</td><td><StatusBadge status={r.status} /></td></tr>))}</tbody></table><div style={{marginTop:'15px', fontSize:'0.85rem', color:'#94a3b8', fontStyle:'italic'}}>* Para abrir novas solicitações, use o comando <strong>/theris</strong> no Slack.</div></div>
                      {['SUPER_ADMIN', 'ADMIN', 'APPROVER'].includes(systemProfile) && (
                          <div className="glass-card" id="deputy-form">
                            <h3 style={{marginBottom:'20px', display:'flex', alignItems:'center', gap:'10px'}}><UserPlus size={20} color="#0ea5e9"/> Configurar Substituto (Deputy)</h3>
                            <div style={{display:'flex', alignItems:'center', gap:'20px', marginBottom:'20px', padding:'15px', background:'rgba(255,255,255,0.05)', borderRadius:'10px'}}><div><span style={{color:'#64748b', fontSize:'0.8rem', textTransform:'uppercase'}}>Deputy Atual:</span></div><div style={{fontWeight:600, color: currentUser?.myDeputy ? '#10b981' : '#64748b'}}>{currentUser?.myDeputy ? currentUser.myDeputy.name : 'Nenhum definido'}</div></div>
                            <form onSubmit={handleDeputyRequest} className="modern-form"><div className="form-group full-width"><label>Indicar Novo Deputy</label><select className="modern-input" value={targetUserId} onChange={e => setTargetUserId(e.target.value)}><option value="">-- Selecione um colaborador --</option>{allUsers.filter(u => u.id !== currentUser?.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div><button type="submit" className="primary-btn full-width">Solicitar Troca</button></form>
                          </div>
                      )}
                  </div>
                  <div style={{flex: 1}}><ActivityFeed requests={requests} /></div>
               </div>
            </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="glass-card">
                 <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'15px'}}><h3>Histórico de Transações e Auditoria</h3>
                    <div className="filter-bar">
                        <div className="filter-item"><Search size={16} color="#94a3b8"/><input placeholder="Buscar por Nome, Email ou ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="filter-input"/></div>
                        <div className="filter-item"><Calendar size={16} color="#94a3b8"/><input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="filter-input date-input"/></div>
                        <div className="filter-item"><Filter size={16} color="#94a3b8"/><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-input select-input"><option value="ALL">Todos</option><option value="APROVADO">Aprovados</option><option value="REPROVADO">Reprovados</option></select></div>
                        {(searchTerm || filterDate || filterStatus !== 'ALL') && (<button onClick={()=>{setSearchTerm(''); setFilterDate(''); setFilterStatus('ALL')}} style={{background:'none', border:'none', color:'#f59e0b', cursor:'pointer', fontSize:'0.8rem', textDecoration:'underline'}}>Limpar</button>)}
                    </div>
                 </div>
                 <table className="modern-table"><thead><tr><th>ID TRANSAÇÃO</th><th>DATA</th><th>SOLICITANTE</th><th>EMAIL</th><th>DETALHES</th><th>STATUS</th></tr></thead><tbody>{getFilteredHistory().length === 0 ? (<tr><td colSpan={6} style={{textAlign:'center', padding:'30px', color:'#64748b'}}>Nenhum registro encontrado.</td></tr>) : (getFilteredHistory().map(r => { let info = ''; try { info = JSON.parse(r.details).info } catch (e) {} return (<tr key={r.id}><td style={{fontFamily:'monospace', color:'#64748b', fontSize:'0.8rem'}}><Hash size={12} style={{verticalAlign:'middle'}}/> {r.id.slice(0, 8)}...</td><td>{new Date(r.updatedAt).toLocaleDateString()}</td><td><div style={{fontWeight:600, color:'white'}}>{r.requester?.name}</div><div style={{fontSize:'0.7rem', color:'#64748b'}}>ID: {r.requesterId.slice(0,8)}...</div></td><td style={{color:'#cbd5e1', fontSize:'0.9rem'}}>{r.requester?.email}</td><td style={{color:'#94a3b8'}}>{info}</td><td><StatusBadge status={r.status} /></td></tr>) }))}</tbody></table>
             </div>
          )}

          {activeTab === 'ORG' && (<div className="glass-card">{structure.map(dept => (<div key={dept.id} className="dept-item"><div onClick={() => setExpandedDepts(p => p.includes(dept.id)?p.filter(i=>i!==dept.id):[...p,dept.id])} className="dept-header">{expandedDepts.includes(dept.id) ? <ChevronDown size={18} color="#0ea5e9"/> : <ChevronRight size={18}/>} <span>{dept.name}</span></div>{expandedDepts.includes(dept.id) && (<div className="dept-content">{dept.roles.map((r,i) => (<div key={i} className="role-group"><div className="role-title">{r.name}</div><div className="user-tags">{r.users.map(u => <div key={u.id} className="user-tag">{u.name}</div>)}</div></div>))}</div>)}</div>))}</div>)}
          {activeTab === 'TOOLS' && (<div className="glass-card"><h3>Catálogo de Ferramentas</h3><table className="modern-table"><thead><tr><th>NOME</th><th>OWNER</th></tr></thead><tbody>{tools.map(t => (<tr key={t.id}><td>{t.name}</td><td>{t.owner?.name || 'Sem Dono'}</td></tr>))}</tbody></table></div>)}
        </div>
      </main>
    </div>
  );
}