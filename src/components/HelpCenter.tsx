import { useState } from "react";
import { availableHelpTrails, type HelpEnvironment } from "../lib/helpTrails";

/** Progressive help: no session, coordinates, incident data or progress persists. */
export function HelpCenter({ environment }: { environment: HelpEnvironment }) {
  const trails = availableHelpTrails(environment);
  const [selectedId,setSelectedId] = useState("");
  const [checked,setChecked] = useState<Record<string, number[]>>({});
  const current = trails.find(trail=>trail.id===selectedId) ?? trails[0];
  const completed = current ? (checked[current.id] ?? []) : [];
  if (!current) return null;

  const toggleStep = (index:number,enabled:boolean) => {
    setChecked(previous=>{
      const values=new Set(previous[current.id] ?? []);
      if(enabled) values.add(index); else values.delete(index);
      return {...previous,[current.id]:[...values]};
    });
  };

  return <section className="panel help-panel" aria-label="Manual e trilhas guiadas">
    <details className="help-details">
      <summary className="help-summary">
        <span><strong>Manual e trilhas guiadas</strong><small>Passo a passo para operação, laboratórios, APIs e recuperação</small></span>
        <span className="help-summary-action">Abrir ajuda</span>
      </summary>
      <div className="help-content">
        <p className="hint">Escolha uma trilha. Marque as etapas praticadas; o progresso é somente desta tela e não autoriza operação.</p>
        <nav className="help-trail-nav" aria-label="Selecione uma trilha de orientação">
          {trails.map(trail=><button type="button" key={trail.id}
            className={"help-trail-button"+(current.id===trail.id?" selected":"")}
            aria-pressed={current.id===trail.id}
            onClick={()=>setSelectedId(trail.id)}>{trail.title}</button>)}
        </nav>
        <div className="help-trail-body">
          <div className="section-head">
            <div><h3>{current.title}</h3><p>{current.audience}</p></div>
            <span className="pill" role="status" aria-live="polite">{completed.length}/{current.steps.length} etapas</span>
          </div>
          <p className="detail">{current.summary}</p>
          <ol className="help-step-list">
            {current.steps.map((step,index)=><li key={index}>
              <label className="help-step">
                <input type="checkbox" checked={completed.includes(index)}
                  onChange={event=>toggleStep(index,event.target.checked)}/>
                <span>{step}</span>
              </label>
            </li>)}
          </ol>
          <p className="notice warning" role="note">{current.caution}</p>
          <button type="button" className="secondary help-reset" disabled={completed.length===0}
            onClick={()=>setChecked(old=>({...old,[current.id]:[]}))}>Reiniciar esta trilha</button>
        </div>
      </div>
    </details>
  </section>;
}
