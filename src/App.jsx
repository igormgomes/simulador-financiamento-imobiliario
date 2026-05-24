import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

function buildCurve(inicio, fim, mesesHold, total) {
  return Array.from({ length: total }, (_, i) => {
    const m = i + 1;
    if (m <= mesesHold) return inicio;
    const progress = (m - mesesHold) / (total - mesesHold);
    return inicio + (fim - inicio) * progress;
  });
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}
function formatPct(v) { return `${v.toFixed(1)}%`; }

const PRESETS = [
  { label: 'Otimista',     selicInicio: 14.5, selicFim: 8.0,  trInicio: 2.0, trFim: 0.5, mesesHold: 6,  desc: 'Selic cai a 8% nos próximos anos' },
  { label: 'Base (Focus)', selicInicio: 14.5, selicFim: 9.5,  trInicio: 2.0, trFim: 1.0, mesesHold: 12, desc: 'Projeção Focus: ~9,5% em 2028' },
  { label: 'Conservador',  selicInicio: 14.5, selicFim: 11.0, trInicio: 2.0, trFim: 1.5, mesesHold: 18, desc: 'Juros estruturalmente altos' },
  { label: 'Pessimista',   selicInicio: 14.5, selicFim: 13.0, trInicio: 2.0, trFim: 1.8, mesesHold: 24, desc: 'Selic praticamente estável' },
];

const INPUT_STYLE = {
  background: '#0a1220', border: '1px solid #1e3a5f', borderRadius: '6px',
  color: '#e2e8f0', fontFamily: 'sans-serif', fontSize: '14px',
  padding: '8px 10px', width: '100%', boxSizing: 'border-box', outline: 'none',
};

const LABEL_STYLE = {
  fontSize: '10px', letterSpacing: '1.5px', color: '#64748b',
  textTransform: 'uppercase', marginBottom: '5px', fontFamily: 'sans-serif', display: 'block',
};

export default function Simulador() {
  // Dados do contrato — editáveis pelo usuário
  const [saldoDevedor, setSaldoDevedor] = useState(300000);
  const [amortizacaoMensal, setAmortizacaoMensal] = useState(2000);
  const [taxaJurosAnual, setTaxaJurosAnual] = useState(7.0);
  const [parcelasRestantes, setParcelasRestantes] = useState(120);

  // Cenário de juros
  const [activePreset, setActivePreset] = useState(1);
  const [selicInicio, setSelicInicio] = useState(14.5);
  const [selicFim, setSelicFim] = useState(9.5);
  const [trInicio, setTrInicio] = useState(2.0);
  const [trFim, setTrFim] = useState(1.0);
  const [mesesHold, setMesesHold] = useState(12);
  const [ir, setIr] = useState(15);
  const [tab, setTab] = useState('resultado');

  function applyPreset(i) {
    const p = PRESETS[i];
    setSelicInicio(p.selicInicio); setSelicFim(p.selicFim);
    setTrInicio(p.trInicio); setTrFim(p.trFim);
    setMesesHold(p.mesesHold); setActivePreset(i);
  }

  const resultado = useMemo(() => {
    const total = Math.max(1, Math.round(parcelasRestantes));
    const taxaAnual = taxaJurosAnual / 100;
    const taxaMensalContrato = Math.pow(1 + taxaAnual, 1 / 12) - 1;
    const selicCurve = buildCurve(selicInicio, selicFim, mesesHold, total);
    const trCurve = buildCurve(trInicio, trFim, mesesHold, total);

    let saldoFin = saldoDevedor;
    let fundoInveste = saldoDevedor;
    let totalJurosFin = 0;
    const chartData = [], selicChartData = [];

    for (let mes = 1; mes <= total; mes++) {
      const selicAnualMes = selicCurve[mes - 1];
      const trAnualMes = trCurve[mes - 1];
      const selicMensal = Math.pow(1 + selicAnualMes / 100, 1 / 12) - 1;
      const selicLiquidaMensal = selicMensal * (1 - ir / 100);
      const trMensal = Math.pow(1 + trAnualMes / 100, 1 / 12) - 1;

      const juros = saldoFin * taxaMensalContrato;
      const correcaoTR = saldoFin * trMensal;
      const parcela = amortizacaoMensal + juros + correcaoTR;
      saldoFin = Math.max(0, saldoFin - amortizacaoMensal + correcaoTR);
      totalJurosFin += juros + correcaoTR;
      fundoInveste = fundoInveste * (1 + selicLiquidaMensal) - parcela;

      const intervalo = Math.max(1, Math.floor(total / 24));
      if (mes % intervalo === 0 || mes === total) {
        const ano = 2026 + Math.floor((mes - 1) / 12);
        const mesLabel = mes % 12 === 0 ? `${ano}` : `${ano}.${String(mes % 12).padStart(2, '0')}`;
        chartData.push({ label: mesLabel, mes, saldoFin: Math.max(0, Math.round(saldoFin)), fundoInveste: Math.round(fundoInveste) });
        selicChartData.push({
          label: mesLabel, mes,
          selic: parseFloat(selicAnualMes.toFixed(2)),
          custoFin: parseFloat((taxaJurosAnual + trAnualMes).toFixed(2)),
          selicLiquida: parseFloat(((Math.pow(1 + selicAnualMes / 100, 1/12) - 1) * (1 - ir / 100) * 12 * 100).toFixed(2)),
        });
      }
    }

    const selicMedia = selicCurve.reduce((a, b) => a + b, 0) / selicCurve.length;
    const trMedia = trCurve.reduce((a, b) => a + b, 0) / trCurve.length;

    return {
      fundoFinal: fundoInveste,
      totalJurosFin,
      vantagem: fundoInveste > 0,
      diferencaFinal: Math.abs(fundoInveste),
      chartData, selicChartData,
      custoMedioFin: (taxaJurosAnual + trMedia).toFixed(2),
      selicLiquidaMedia: (((Math.pow(1 + selicMedia / 100, 1/12) - 1) * (1 - ir / 100)) * 12 * 100).toFixed(2),
    };
  }, [saldoDevedor, amortizacaoMensal, taxaJurosAnual, parcelasRestantes, selicInicio, selicFim, trInicio, trFim, mesesHold, ir]);

  const vantagem = resultado.vantagem;

  const anoAtual = 2026;
  const mesCaidaInicio = mesesHold === 0 ? 'imediatamente' : `em ${Math.floor(mesesHold / 12) > 0 ? Math.floor(mesesHold / 12) + ' ano(s) e ' : ''}${mesesHold % 12 > 0 ? mesesHold % 12 + ' meses' : ''}`;
  const anoCaidaInicio = anoAtual + Math.floor(mesesHold / 12);

  const sliders = [
    {
      label: 'Selic hoje (% a.a.)',
      value: selicInicio, set: setSelicInicio, min: 8, max: 18, step: 0.25, color: '#60a5fa',
      hint: `Taxa básica de juros atual. Quanto maior, mais o seu dinheiro rende investido na renda fixa.`,
    },
    {
      label: 'Selic no fim do período (% a.a.)',
      value: selicFim, set: setSelicFim, min: 5, max: 15, step: 0.25, color: '#818cf8',
      hint: `Nível que você espera que a Selic atinja ao final do financiamento. Quanto menor, menos vantajoso fica investir ao longo do tempo.`,
    },
    {
      label: 'TR hoje (% a.a.)',
      value: trInicio, set: setTrInicio, min: 0, max: 4, step: 0.1, color: '#34d399',
      hint: `A TR é uma correção monetária que incide sobre o saldo do seu financiamento todo mês — ela aumenta o custo real da dívida além da taxa de juros contratual.`,
    },
    {
      label: 'TR no fim do período (% a.a.)',
      value: trFim, set: setTrFim, min: 0, max: 3, step: 0.1, color: '#6ee7b7',
      hint: `A TR tende a cair junto com a Selic. Defina o patamar esperado ao final do contrato.`,
    },
    {
      label: 'Tempo até a Selic começar a cair (meses)',
      value: mesesHold, set: setMesesHold, min: 0, max: 36, step: 3, color: '#fbbf24',
      fmt: (v) => v === 0 ? 'já cai' : `${v} meses`,
      hint: mesesHold === 0
        ? `A Selic começa a cair imediatamente, já no próximo mês.`
        : `A Selic fica estável em ${selicInicio}% pelos próximos ${mesesHold} meses (até ${anoCaidaInicio}). Só depois começa a cair gradualmente até ${selicFim}% ao final do contrato. Isso simula o fato de que o Banco Central mantém os juros por um tempo antes de iniciar um ciclo de cortes.`,
    },
    {
      label: 'Imposto de Renda sobre renda fixa (%)',
      value: ir, set: setIr, min: 15, max: 22.5, step: 2.5, color: '#f87171',
      hint: `O IR incide sobre o rendimento da renda fixa. Para investimentos acima de 2 anos, a alíquota é 15%. Para menos de 6 meses, é 22,5%. Como o horizonte aqui é longo, 15% é o mais adequado.`,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#080c14', color: '#dde3f0', fontFamily: "'Georgia', serif" }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #0f1f3d 0%, #0a1628 60%, #080c14 100%)', padding: '36px 28px 28px', borderBottom: '1px solid #1a2744' }}>
        <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'sans-serif' }}>
          Simulador de Financiamento Imobiliário
        </div>
        <h1 style={{ fontSize: 'clamp(20px, 4vw, 32px)', fontWeight: '400', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          Vale mais amortizar ou investir?
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, fontFamily: 'sans-serif', lineHeight: '1.65', maxWidth: '580px' }}>
          Se você tem o valor equivalente ao saldo devedor disponível, o que compensa mais: quitar a dívida hoje ou manter investido na Selic pagando as parcelas? Informe os dados do contrato e simule diferentes cenários de juros.
        </p>
      </div>

      <div style={{ padding: '20px 20px 48px', maxWidth: '920px', margin: '0 auto' }}>

        {/* Dados do contrato */}
        <div style={{ background: '#0d1526', border: '1px solid #1a2744', borderRadius: '8px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '4px', fontFamily: 'sans-serif' }}>
            Passo 1 — Dados do seu contrato
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label style={LABEL_STYLE}>Saldo devedor atual (R$)</label>
              <input type="number" value={saldoDevedor} onChange={(e) => setSaldoDevedor(parseFloat(e.target.value) || 0)} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Amortização mensal SAC (R$)</label>
              <input type="number" value={amortizacaoMensal} onChange={(e) => setAmortizacaoMensal(parseFloat(e.target.value) || 0)} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Taxa de juros do contrato (% a.a.)</label>
              <input type="number" step="0.01" value={taxaJurosAnual} onChange={(e) => setTaxaJurosAnual(parseFloat(e.target.value) || 0)} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Parcelas restantes</label>
              <input type="number" value={parcelasRestantes} onChange={(e) => setParcelasRestantes(parseInt(e.target.value) || 1)} style={INPUT_STYLE} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#334155', fontFamily: 'sans-serif' }}>
            ⚠️ Informe apenas a taxa contratual, sem TR — ela é adicionada separadamente nos sliders abaixo, pois varia ao longo do tempo junto com a Selic.
          </div>
        </div>

        {/* Presets */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'sans-serif' }}>Passo 2 — Cenário de juros</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
            {PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => applyPreset(i)} style={{
                padding: '10px 12px', textAlign: 'left',
                background: activePreset === i ? '#1e3a5f' : '#0f1c2e',
                border: `1px solid ${activePreset === i ? '#3b82f6' : '#1e2a40'}`,
                borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: activePreset === i ? '#93c5fd' : '#94a3b8', fontFamily: 'sans-serif', marginBottom: '2px' }}>{p.label}</div>
                <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'sans-serif' }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ background: '#0d1526', border: '1px solid #1a2744', borderRadius: '8px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#475569', textTransform: 'uppercase', marginBottom: '14px', fontFamily: 'sans-serif' }}>Ajuste fino da trajetória de juros</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {sliders.map((s) => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'sans-serif' }}>{s.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: s.color, fontFamily: 'sans-serif' }}>
                    {s.fmt ? s.fmt(s.value) : formatPct(s.value)}
                  </span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={(e) => { s.set(parseFloat(e.target.value)); setActivePreset(null); }}
                  style={{ width: '100%', accentColor: s.color }} />
                {s.hint && (
                  <div style={{ fontSize: '11px', color: '#334155', fontFamily: 'sans-serif', marginTop: '5px', lineHeight: '1.5' }}>
                    {s.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Result banner */}
        <div style={{
          background: vantagem ? 'linear-gradient(135deg, #052e16 0%, #064e3b 100%)' : 'linear-gradient(135deg, #450a0a 0%, #7c2d12 100%)',
          border: `1px solid ${vantagem ? '#16a34a' : '#b91c1c'}`,
          borderRadius: '8px', padding: '22px', marginBottom: '20px',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: vantagem ? '#4ade80' : '#fca5a5', textTransform: 'uppercase', marginBottom: '4px', fontFamily: 'sans-serif' }}>
              {vantagem ? '✓ Vale mais investir' : '✗ Vale mais amortizar'}
            </div>
            <div style={{ fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: '300', letterSpacing: '-1px', color: '#fff' }}>
              {vantagem ? '+' : '-'}{formatBRL(resultado.diferencaFinal)}
            </div>
            <div style={{ fontSize: '12px', color: vantagem ? '#86efac' : '#fca5a5', fontFamily: 'sans-serif', marginTop: '2px' }}>
              {vantagem ? 'sobra ao final do período — investir é a melhor opção' : 'o fundo se esgota antes do fim — amortizar poupa mais'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
            {[
              { label: 'Custo médio do financiamento', value: `${resultado.custoMedioFin}% a.a.`, color: '#f87171' },
              { label: 'Selic líquida média', value: `${resultado.selicLiquidaMedia}% a.a.`, color: '#34d399' },
              { label: 'Total juros + TR a pagar', value: formatBRL(resultado.totalJurosFin), color: '#fb923c' },
            ].map((m) => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontFamily: 'sans-serif', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>{m.label}</span>
                <span style={{ color: m.color, fontWeight: '700' }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          {[['resultado', 'Resultado financeiro'], ['taxas', 'Trajetória de juros']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '8px 16px', fontSize: '12px', fontFamily: 'sans-serif',
              background: tab === key ? '#1e3a5f' : 'transparent',
              border: `1px solid ${tab === key ? '#3b82f6' : '#1a2744'}`,
              borderRadius: '6px', color: tab === key ? '#93c5fd' : '#64748b', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: '#0d1526', border: '1px solid #1a2744', borderRadius: '8px', padding: '18px', marginBottom: '16px' }}>
          {tab === 'resultado' ? (
            <>
              <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#475569', textTransform: 'uppercase', marginBottom: '14px', fontFamily: 'sans-serif' }}>
                Evolução do saldo devedor vs fundo investido
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={resultado.chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 10 }} interval={3} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: '#334155', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#0f1c2e', border: '1px solid #1e3a5f', borderRadius: '6px', fontFamily: 'sans-serif', fontSize: '12px' }} formatter={(v, name) => [formatBRL(v), name]} labelStyle={{ color: '#64748b' }} />
                  <Legend wrapperStyle={{ fontFamily: 'sans-serif', fontSize: '11px' }} />
                  <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="saldoFin" name="Saldo devedor" stroke="#f87171" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fundoInveste" name="Fundo (Selic líquida - parcelas)" stroke="#34d399" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '11px', color: '#334155', fontFamily: 'sans-serif', marginTop: '6px', textAlign: 'center' }}>
                Linha verde = fundo investido pagando as parcelas · Quando cruza zero, o dinheiro acabou antes do financiamento
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#475569', textTransform: 'uppercase', marginBottom: '14px', fontFamily: 'sans-serif' }}>
                Trajetória da Selic vs custo real do financiamento
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={resultado.selicChartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 10 }} interval={3} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: '#334155', fontSize: 10 }} domain={[5, 18]} />
                  <Tooltip contentStyle={{ background: '#0f1c2e', border: '1px solid #1e3a5f', borderRadius: '6px', fontFamily: 'sans-serif', fontSize: '12px' }} formatter={(v, name) => [`${v.toFixed(2)}%`, name]} labelStyle={{ color: '#64748b' }} />
                  <Legend wrapperStyle={{ fontFamily: 'sans-serif', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="selic" name="Selic bruta" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="selicLiquida" name="Selic líquida (após IR)" stroke="#818cf8" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="custoFin" name="Custo financiamento (juros+TR)" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '11px', color: '#334155', fontFamily: 'sans-serif', marginTop: '6px', textAlign: 'center' }}>
                Enquanto a linha roxa (Selic líquida) estiver acima da vermelha (custo do financiamento) → vale investir
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: '#0a1220', border: '1px solid #141f33', borderRadius: '8px', padding: '16px', fontSize: '12px', lineHeight: '1.7', color: '#475569', fontFamily: 'sans-serif' }}>
          <strong style={{ color: '#64748b' }}>Metodologia:</strong> O fundo começa com o saldo devedor informado, rende a Selic líquida mês a mês (com IR de {ir}%) e paga cada parcela SAC conforme o calendário. A Selic e TR variam linearmente do valor inicial ao final, com {mesesHold} meses de estabilidade antes de cair.
        </div>
      </div>
    </div>
  );
}
