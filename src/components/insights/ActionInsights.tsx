interface ActionInsight {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

interface ActionInsightsProps {
  insights: ActionInsight[];
}

export function ActionInsights({ insights }: ActionInsightsProps) {
  return (
    <section className="chart-card">
      <h3>Handlungsempfehlungen</h3>
      <p className="chart-subtitle">Automatische Schlussfolgerungen fuer schnelle Entscheidungen</p>
      <div className="insight-list">
        {insights.map((insight) => (
          <article key={insight.id} className={`insight-item ${insight.severity}`}>
            <h4>{insight.title}</h4>
            <p>{insight.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
