import {analyzeGpsQuality,type GpsQualitySample} from "../lib/gpsQualityIntelligence";
import {gpsAccuracyLabel} from "../lib/gpsPrecision";

type Props={active:boolean;history:readonly GpsQualitySample[];now:number};
const trends={
  improving:"Melhorando",worsening:"Piorando",stable:"Estável",insufficient:"Aguardando leituras"
} as const;
/**
 * Explanatory, non-authoritative local guidance. No pretrained model and no
 * external AI calls are enabled. Location transmission is governed by the
 * existing session/team/consent/accuracy gates, never this assistant.
 */
export function GpsQualityAssistant({active,history,now}:Props){
  const summary=analyzeGpsQuality(active?history:[],now);
  return <section className="gps-quality-assistant" aria-label="Assistente de qualidade GPS">
    <div className="gps-quality-heading">
      <strong>Assistente de qualidade GPS</strong>
      <span className="gps-quality-mode">Análise local · sem IA externa conectada</span>
    </div>
    <div className="gps-quality-stats">
      <span>Tendência: <b>{trends[summary.trend]}</b></span>
      <span>Mediana estimada: <b>{gpsAccuracyLabel(summary.medianAccuracyMeters)}</b></span>
      <span>Leituras recentes: <b>{summary.sampleCount}</b></span>
    </div>
    <p className="gps-quality-advice" role="status" aria-live="polite">{summary.explanation}</p>
    <p className="gps-quality-footnote">As sugestões são estatísticas, não alteram coordenadas nem autorizam envio. Uma IA do cliente poderá ser conectada futuramente pelo backend, com consentimento.</p>
  </section>;
}
