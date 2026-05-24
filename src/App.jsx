import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

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

// Animated number hook
function useAnimatedValue(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * ease));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

// Tooltip component for sliders
function SliderTooltip({ hint }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block', marginLeft: '6px' }}>
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        style={{
          background: 'none', border: '1px solid #334155', borderRadius: '50%',
          color: '#475569', fontSize: '10px', width: '16px', height: '16px',
          cursor: 'pointer', lineHeight: '14px', padding: 0, fontFamily: 'sans-serif',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >?</button>
      {visible && (
        <div style={{
          position: 'absolute', bottom: '24px', left: '-120px', width: '260px',
          background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
          padding: '10px 12px', fontSize: '11px', color: '#94a3b8',
          fontFamily: 'sans-serif', lineHeight: '1.6', zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {hint}
          <div style={{
            position: 'absolute', bottom: '-6px', left: '126px',
            width: '10px', height: '10px', background: '#1e293b',
            border: '1px solid #334155', borderTop: 'none', borderLeft: 'none',
            transform: 'rotate(45deg)',
          }} />
        </div>
      )}
    </div>
  );
}

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
  const [saldoDevedor, setSaldoDevedor] = useState(300000);
  const [amortizacaoMensal, setAmortizacaoMensal] = useState(2000);
  const [taxaJurosAnual, setTaxaJurosAnual] = useState(7.0);
  const [parcelasRestantes, setParcelasRestantes] = useState(120);
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

    let fundoBruto = saldoDevedor;
    for (let mes = 1; mes <= total; mes++) {
      const selicAnualMes = selicCurve[mes - 1];
      const selicMensal = Math.pow(1 + selicAnualMes / 100, 1 / 12) - 1;
      fundoBruto = fundoBruto * (1 + selicMensal * (1 - ir / 100));
    }

    const totalParcelasPagas = amortizacaoMensal * total + totalJurosFin;
    const anos = Math.round(total / 12);

    return {
      fundoFinal: fundoInveste, fundoBruto, totalJurosFin, totalParcelasPagas, anos,
      vantagem: fundoInveste > 0,
      diferencaFinal: Math.abs(fundoInveste),
      chartData, selicChartData,
      custoMedioFin: (taxaJurosAnual + trMedia).toFixed(2),
      selicLiquidaMedia: (((Math.pow(1 + selicMedia / 100, 1/12) - 1) * (1 - ir / 100)) * 12 * 100).toFixed(2),
    };
  }, [saldoDevedor, amortizacaoMensal, taxaJurosAnual, parcelasRestantes, selicInicio, selicFim, trInicio, trFim, mesesHold, ir]);

  const vantagem = resultado.vantagem;
  const animatedDiferenca = useAnimatedValue(Math.round(resultado.diferencaFinal));
  const animatedFundoBruto = useAnimatedValue(Math.round(resultado.fundoBruto));
  const anoCaidaInicio = 2026 + Math.floor(mesesHold / 12);

  const sliders = [
    {
      label: 'Selic hoje (% a.a.)', value: selicInicio, set: setSelicInicio, min: 8, max: 18, step: 0.25, color: '#60a5fa',
      hint: 'Taxa básica de juros atual. Quanto maior, mais o seu dinheiro rende investido na renda fixa.',
    },
    {
      label: 'Selic no fim do período (% a.a.)', value: selicFim, set: setSelicFim, min: 5, max: 15, step: 0.25, color: '#818cf8',
      hint: 'Nível que você espera que a Selic atinja ao final do financiamento. Quanto menor, menos vantajoso fica investir ao longo do tempo.',
    },
    {
      label: 'TR hoje (% a.a.)', value: trInicio, set: setTrInicio, min: 0, max: 4, step: 0.1, color: '#34d399',
      hint: 'A TR é uma correção monetária que incide sobre o saldo do financiamento todo mês — ela aumenta o custo real da dívida além da taxa contratual.',
    },
    {
      label: 'TR no fim do período (% a.a.)', value: trFim, set: setTrFim, min: 0, max: 3, step: 0.1, color: '#6ee7b7',
      hint: 'A TR tende a cair junto com a Selic. Defina o patamar esperado ao final do contrato.',
    },
    {
      label: 'Tempo até a Selic começar a cair (meses)', value: mesesHold, set: setMesesHold, min: 0, max: 36, step: 3, color: '#fbbf24',
      fmt: (v) => v === 0 ? 'já cai' : `${v} meses`,
      hint: mesesHold === 0
        ? 'A Selic começa a cair imediatamente, já no próximo mês.'
        : `A Selic fica estável em ${selicInicio}% pelos próximos ${mesesHold} meses (até ${anoCaidaInicio}). Só depois começa a cair gradualmente até ${selicFim}% ao final do contrato.`,
    },
    {
      label: 'Imposto de Renda sobre renda fixa (%)', value: ir, set: setIr, min: 15, max: 22.5, step: 2.5, color: '#f87171',
      hint: 'O IR incide sobre o rendimento da renda fixa. Para investimentos acima de 2 anos, a alíquota é 15%. Para menos de 6 meses, é 22,5%. Como o horizonte aqui é longo, 15% é o mais adequado.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#080c14', color: '#dde3f0', fontFamily: "'Georgia', serif" }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #0f1f3d 0%, #0a1628 60%, #080c14 100%)', padding: '36px 28px 32px', borderBottom: '1px solid #1a2744' }}>
        <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'sans-serif' }}>
          Analisador de Financiamento Imobiliário
        </div>
        <h1 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: '400', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
          Quitar o financiamento ou manter investido?
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, fontFamily: 'sans-serif', lineHeight: '1.65', maxWidth: '580px' }}>
          Se você tem o valor equivalente ao saldo do seu financiamento disponível, o que compensa mais: quitar a dívida hoje ou manter o dinheiro investido na Selic pagando as parcelas normalmente? Informe os dados do contrato e simule diferentes trajetórias de juros.
        </p>
      </div>

      <div style={{ padding: '20px 20px 48px', maxWidth: '920px', margin: '0 auto' }}>

        {/* Step 1 */}
        <div style={{ background: '#0d1526', border: '1px solid #1a2744', borderRadius: '8px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1d4ed8', color: '#fff', fontSize: '12px', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>1</div>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#3b82f6', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>Dados do seu contrato</div>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', fontFamily: 'sans-serif', marginBottom: '14px', marginLeft: '34px' }}>
            Encontre essas informações no extrato do seu banco (DDC ou demonstrativo de saldo devedor)
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
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#334155', fontFamily: 'sans-serif' }}>
            ⚠️ Informe apenas a taxa contratual, sem TR — ela é adicionada separadamente nos sliders abaixo, pois varia ao longo do tempo junto com a Selic.
          </div>
        </div>

        {/* Step 2 — Presets */}
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1d4ed8', color: '#fff', fontSize: '12px', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>2</div>
          <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#475569', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>Cenário de juros</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '20px' }}>
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

        {/* Sliders */}
        <div style={{ background: '#0d1526', border: '1px solid #1a2744', borderRadius: '8px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#475569', textTransform: 'uppercase', marginBottom: '14px', fontFamily: 'sans-serif' }}>
            Ajuste fino da trajetória de juros
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {sliders.map((s) => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'sans-serif' }}>{s.label}</span>
                    <SliderTooltip hint={s.hint} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: s.color, fontFamily: 'sans-serif' }}>
                    {s.fmt ? s.fmt(s.value) : formatPct(s.value)}
                  </span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={(e) => { s.set(parseFloat(e.target.value)); setActivePreset(null); }}
                  style={{ width: '100%', accentColor: s.color }} />
              </div>
            ))}
          </div>
        </div>

        {/* Result banner */}
        <div style={{
          background: vantagem ? 'linear-gradient(135deg, #052e16 0%, #064e3b 100%)' : 'linear-gradient(135deg, #450a0a 0%, #7c2d12 100%)',
          border: `1px solid ${vantagem ? '#16a34a' : '#b91c1c'}`,
          borderRadius: '8px', padding: '24px', marginBottom: '20px',
          transition: 'background 0.5s ease, border-color 0.5s ease',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '2px', color: vantagem ? '#4ade80' : '#fca5a5', textTransform: 'uppercase', marginBottom: '4px', fontFamily: 'sans-serif', transition: 'color 0.4s' }}>
                {vantagem ? '✓ Vale mais investir' : '✗ Vale mais amortizar'}
              </div>
              <div style={{
                fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: '300', letterSpacing: '-1px', color: '#fff',
                transition: 'color 0.4s',
                fontFamily: 'sans-serif',
              }}>
                {vantagem ? '+' : '-'}{formatBRL(animatedDiferenca)}
              </div>
              <div style={{ fontSize: '12px', color: vantagem ? '#86efac' : '#fca5a5', fontFamily: 'sans-serif', marginTop: '2px', transition: 'color 0.4s' }}>
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

          {/* Narrative */}
          <div style={{
            padding: '16px 18px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '6px',
            fontSize: '13px',
            color: vantagem ? '#a7f3d0' : '#fde68a',
            fontFamily: 'sans-serif',
            lineHeight: '1.8',
            borderLeft: `3px solid ${vantagem ? '#4ade80' : '#f87171'}`,
            transition: 'border-color 0.4s, color 0.4s',
          }}>
            {vantagem ? (
              <>
                Investindo <strong style={{color:'#fff'}}>{formatBRL(saldoDevedor)}</strong> hoje,
                seu fundo cresce para aproximadamente <strong style={{color:'#fff'}}>{formatBRL(animatedFundoBruto)}</strong> em{' '}
                <strong style={{color:'#fff'}}>{resultado.anos} anos</strong> — rendendo a Selic líquida sem sacar nada.
                Ao mesmo tempo, seu financiamento geraria <strong style={{color:'#fff'}}>{formatBRL(resultado.totalJurosFin)}</strong> em
                juros + TR nesse período. Como o fundo rende mais do que a dívida custa,
                sobram <strong style={{color:'#4ade80'}}>{formatBRL(animatedDiferenca)}</strong> depois
                de pagar todas as parcelas.{' '}
                <strong style={{color:'#4ade80'}}>Investir é a melhor decisão nesse cenário.</strong>
              </>
            ) : (
              <>
                Investindo <strong style={{color:'#fff'}}>{formatBRL(saldoDevedor)}</strong> hoje,
                seu fundo cresceria para aproximadamente <strong style={{color:'#fff'}}>{formatBRL(animatedFundoBruto)}</strong> em{' '}
                <strong style={{color:'#fff'}}>{resultado.anos} anos</strong>. Porém, o total de parcelas
                a pagar soma <strong style={{color:'#fff'}}>{formatBRL(resultado.totalParcelasPagas)}</strong> — mais
                do que o fundo consegue gerar nesse cenário de juros. Quitar o financiamento hoje
                economiza <strong style={{color:'#f87171'}}>{formatBRL(animatedDiferenca)}</strong> no total.{' '}
                <strong style={{color:'#f87171'}}>Amortizar é a melhor decisão nesse cenário.</strong>
              </>
            )}
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
                  <ReferenceLine x="2026" stroke="#475569" strokeDasharray="4 2" label={{ value: 'hoje', fill: '#475569', fontSize: 10 }} />
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
          <strong style={{ color: '#64748b' }}>Como funciona:</strong> O simulador parte do princípio que você tem o valor do saldo devedor disponível. No cenário <strong style={{color:'#94a3b8'}}>investir</strong>, esse dinheiro rende a Selic líquida (descontado IR de {ir}%) e é usado mês a mês para pagar as parcelas — o que sobrar ao final é o seu ganho. No cenário <strong style={{color:'#94a3b8'}}>amortizar</strong>, você quita hoje e economiza todos os juros futuros. A Selic e a TR declinam linearmente ao longo do prazo, com {mesesHold} meses de estabilidade antes de começar a cair.
        </div>
      </div>
    </div>
  );
}