import {assessGpsPrecision,gpsAccuracyLabel,GPS_OPERATIONAL_MAX_METERS,GPS_PREFERRED_MAX_METERS} from "../lib/gpsPrecision";

type Props={
  active:boolean;
  accuracyMeters:number|null;
  measuredAt:number|null;
  now:number;
};

/** Live quality-only display. No coordinates, device identifiers, storage,
 * telemetry or background sensors are added by this component.
 */
export function GpsPrecisionMonitor({active,accuracyMeters,measuredAt,now}:Props){
  const fresh=active&&measuredAt!==null&&Number.isFinite(measuredAt)&&
    Number.isFinite(now)&&now>=measuredAt&&now-measuredAt<=30_000;
  const assessment=assessGpsPrecision(fresh?accuracyMeters:null);
  const accuracy=fresh?gpsAccuracyLabel(accuracyMeters):"—";
  const guidance={
    excellent:"Sinal excelente, dentro da meta operacional de 50 metros.",
    good:"Sinal bom, dentro da meta operacional de 50 metros.",
    reduced:"Precisão reduzida: a posição pode ser enviada com essa qualidade indicada, mas aguarde uma leitura de até 50 metros sempre que possível.",
    unreliable:"Precisão acima de 250 metros: esta leitura não é enviada à central. Aguarde ou procure uma área com melhor sinal.",
    unavailable:active?"Aguardando leitura recente do GPS. Nenhuma precisão estimada disponível.":"Ative o compartilhamento autorizado para acompanhar a precisão do GPS."
  }[assessment.level];
  return <div className={"gps-precision-monitor gps-precision-monitor--"+assessment.level}
    role="status" aria-live="polite" aria-atomic="true"
    aria-label={assessment.level==="unavailable"?"Precisão GPS indisponível":`Precisão horizontal estimada: ${accuracy}. Qualidade: ${assessment.label}.`}>
    <div className="gps-precision-top">
      <span className="gps-precision-heading">Precisão atual <small>(estimada)</small></span>
      <strong className="gps-precision-value">{accuracy}</strong>
      <span className="gps-precision-quality">{assessment.label}</span>
    </div>
    <div className="gps-precision-scale" aria-hidden="true">
      <span className={assessment.level==="excellent"?"active":""}/>
      <span className={assessment.level==="good"?"active":""}/>
      <span className={assessment.level==="reduced"?"active":""}/>
      <span className={assessment.level==="unreliable"?"active":""}/>
    </div>
    <div className="gps-precision-thresholds">
      <span>Excelente: até 20 m</span>
      <span>Meta: até {GPS_PREFERRED_MAX_METERS} m</span>
      <span>Limite: {GPS_OPERATIONAL_MAX_METERS} m</span>
    </div>
    <p className="gps-precision-guidance">{guidance}</p>
  </div>;
}
