// Áreas de atuação usadas para classificar os editais pelo objeto.
// Termos sem acento e em minúsculas; casam no início de palavra.
export const AREAS: { id: string; nome: string; termos: string[] }[] = [
  { id: "saude", nome: "Saúde e serviços médicos", termos: ["saude", "medico=", "medica=", "medicos=", "medicas=", "medico-", "hospital", "ubs=", "upa=", "upas=", "plantao", "plantoes", "enfermag", "clinic", "odontolog", "fisioterap", "psicolog", "laborator", "exames=", "exame=", "ambulanc", "samu", "atencao basica", "atencao primaria", "vigilancia epidemiologica", "vigilancia sanitaria", "vigilancia em saude"] },
  { id: "medicamentos", nome: "Medicamentos e insumos", termos: ["medicament", "farmac", "insumos hospitalar", "material hospitalar", "material medico", "materiais medico", "seringa", "luvas", "curativo", "oxigenio medicinal", "ortese", "protese", "soro=", "soros="] },
  { id: "equipamentos_medicos", nome: "Equipamentos médicos", termos: ["equipamento medico", "equipamentos medico", "medico-hospitalar", "desfibril", "monitor multiparam", "ventilador pulmonar", "raio-x", "raio x", "ultrassom", "autoclave", "maca=", "macas=", "cardioversor", "eletrocardio"] },
  { id: "educacao", nome: "Educação, cursos e treinamentos", termos: ["treinamento", "capacitacao", "curso", "qualificacao profissional", "palestra", "educacao continuada", "educacao permanente", "simulacao realistica", "suporte basico de vida", "suporte avancado de vida", "primeiros socorros", "bls=", "acls=", "pals=", "atls=", "material didatico", "pedagog", "ensino"] },
  { id: "obras", nome: "Obras e engenharia", termos: ["obra", "construcao", "reforma", "pavimenta", "engenharia", "edificacao", "drenagem", "recapeamento", "asfalt", "ponte", "terraplenagem", "saneamento", "ampliacao"] },
  { id: "manutencao", nome: "Manutenção predial e instalações", termos: ["manutencao predial", "manutencao preventiva", "manutencao corretiva", "eletric", "hidraulic", "ar condicionado", "ar-condicionado", "climatiza", "elevador", "pintura", "refrigeracao"] },
  { id: "ti", nome: "Tecnologia e software", termos: ["software", "sistema de gestao", "sistema informatizado", "licenca de uso", "licencas de uso", "informatica", "computador", "notebook", "servidores de rede", "rede logica", "internet", "link de dados", "telefonia", "impressora", "outsourcing de impressao", "nuvem", "tecnologia da informacao", "desenvolvimento de sistema"] },
  { id: "limpeza", nome: "Limpeza e facilities", termos: ["limpeza", "conservacao", "higieniza", "jardinagem", "copeiragem", "recepcao", "portaria", "zeladoria", "dedetiza", "desinsetiza", "material de higiene"] },
  { id: "seguranca", nome: "Segurança e vigilância", termos: ["vigilancia patrimonial", "vigilancia armada", "vigilancia desarmada", "vigilancia eletronica", "vigilante", "seguranca patrimonial", "monitoramento eletronico", "cftv", "alarme", "brigad", "videomonitoramento"] },
  { id: "alimentacao", nome: "Alimentação", termos: ["alimentacao", "alimento", "genero alimenticio", "generos alimenticios", "merenda", "refeic", "lanche", "hortifrut", "carne", "cafe", "agua mineral", "cesta basica", "nutricao"] },
  { id: "veiculos", nome: "Veículos, peças e transporte", termos: ["veiculo", "automovel", "onibus", "caminh", "transporte", "frete", "pneu", "pecas", "oficina", "lubrificant", "maquina pesada", "maquinas pesadas", "trator", "retroescavadeira"] },
  { id: "combustiveis", nome: "Combustíveis", termos: ["combustiv", "gasolina", "diesel", "etanol", "gas glp", "gas de cozinha", "gas liquefeito"] },
  { id: "escritorio", nome: "Expediente e mobiliário", termos: ["material de expediente", "materiais de expediente", "papel a4", "toner", "cartucho", "mobiliario", "moveis", "cadeira", "armario", "material de escritorio"] },
  { id: "consultoria", nome: "Consultoria, assessoria e jurídico", termos: ["consultoria", "assessoria", "auditoria", "servicos juridicos", "advocac", "contabil", "pericia", "planejamento estrategico"] },
  { id: "eventos", nome: "Eventos, comunicação e gráfica", termos: ["evento", "show=", "shows=", "palco", "sonorizacao", "publicidade", "comunicacao", "grafica", "banner", "buffet", "decoracao", "festividade"] },
  { id: "residuos", nome: "Resíduos e meio ambiente", termos: ["residuo", "lixo", "aterro", "ambiental", "reciclagem", "coleta seletiva"] },
  { id: "textil", nome: "Uniformes, EPI e lavanderia", termos: ["uniforme", "epi=", "epis=", "equipamentos de protecao", "fardamento", "vestuario", "calcado", "enxoval", "rouparia", "lavanderia"] },
  { id: "locacao", nome: "Locação de imóveis e equipamentos", termos: ["locacao de imovel", "locacao de imoveis", "aluguel", "locacao de equipamento", "locacao de maquina"] },
];
export const NOME_AREA: Record<string, string> = Object.fromEntries(AREAS.map((a) => [a.id, a.nome]));

export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Termo terminado em "=" casa só a palavra inteira; os demais casam no início da palavra.
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const REGEX = AREAS.map((a) => ({ id: a.id, re: new RegExp("(^|[^a-z0-9])(" + a.termos.map((t) => t.endsWith("=") ? esc(t.slice(0, -1)) + "(?![a-z0-9])" : esc(t)).join("|") + ")") }));
export function classificar(texto: string) {
  const t = semAcento(texto);
  return REGEX.filter((r) => r.re.test(t)).map((r) => r.id);
}

export const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
export const MODALIDADES: { id: number; nome: string }[] = [
  { id: 6, nome: "Pregão eletrônico" }, { id: 7, nome: "Pregão presencial" }, { id: 4, nome: "Concorrência eletrônica" },
  { id: 5, nome: "Concorrência presencial" }, { id: 8, nome: "Dispensa (com disputa)" }, { id: 12, nome: "Credenciamento" },
  { id: 3, nome: "Concurso" }, { id: 2, nome: "Diálogo competitivo" },
];
