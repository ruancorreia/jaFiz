from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION

OUT = "Proposta_Preliminar_TCC_JaFiz.docx"

BLUE = "2E74B5"
DARK_BLUE = "1F4D78"
LIGHT = "F4F6F9"
GRAY = "666666"

def set_font(run, name="Calibri", size=11, bold=False, italic=False, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)

def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)

def set_cell_margin(cell, top=80, start=120, bottom=80, end=120):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement("w:tcMar")
        tcPr.append(tcMar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tcMar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tcMar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")

def table_fixed(table, widths):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    tblPr = table._tbl.tblPr
    tblW = tblPr.first_child_found_in("w:tblW")
    tblW.set(qn("w:w"), "9360")
    tblW.set(qn("w:type"), "dxa")
    ind = OxmlElement("w:tblInd")
    ind.set(qn("w:w"), "120")
    ind.set(qn("w:type"), "dxa")
    tblPr.append(ind)
    grid = table._tbl.tblGrid
    for grid_col, w in zip(grid.gridCol_lst, widths):
        grid_col.set(qn("w:w"), str(w))
    for row in table.rows:
        for cell, w in zip(row.cells, widths):
            cell.width = Inches(w / 1440)
            tcW = cell._tc.get_or_add_tcPr().find(qn("w:tcW"))
            tcW.set(qn("w:w"), str(w))
            tcW.set(qn("w:type"), "dxa")
            set_cell_margin(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

def set_borders(table, color="D9E1EA"):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "4")
        e.set(qn("w:space"), "0")
        e.set(qn("w:color"), color)
        borders.append(e)
    tblPr.append(borders)

def mark_header_row(row):
    trPr = row._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    trPr.append(header)

def add_text(p, text, **kwargs):
    r = p.add_run(text)
    set_font(r, **kwargs)
    return r

def add_body(doc, text):
    p = doc.add_paragraph(style="Normal")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    add_text(p, text)
    return p

def add_heading(doc, text, level=1):
    p = doc.add_paragraph(style=f"Heading {level}")
    add_text(p, text, size={1:16, 2:13, 3:12}[level], bold=True,
             color=BLUE if level < 3 else DARK_BLUE)
    return p

def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    add_text(p, text)
    return p

def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    add_text(p, text)
    return p

doc = Document()
section = doc.sections[0]
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.header_distance = Inches(.492)
section.footer_distance = Inches(.492)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Calibri"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
normal.font.size = Pt(11)
normal.paragraph_format.space_after = Pt(8)
normal.paragraph_format.line_spacing = 1.333
for level, before, after, size, color in [(1,18,10,16,BLUE),(2,12,6,13,BLUE),(3,8,4,12,DARK_BLUE)]:
    st = styles[f"Heading {level}"]
    st.font.name = "Calibri"; st.font.size = Pt(size); st.font.color.rgb = RGBColor.from_string(color)
    st.paragraph_format.space_before = Pt(before); st.paragraph_format.space_after = Pt(after)

# Cover page
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(18)
add_text(p, "[NOME DA INSTITUICAO]", size=12, bold=True, color=DARK_BLUE)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(48)
add_text(p, "[CURSO DE GRADUACAO]", size=11, color=GRAY)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(16)
add_text(p, "PROPOSTA PRELIMINAR DE TRABALHO DE CONCLUSAO DE CURSO", size=11, bold=True, color=BLUE)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(12)
add_text(p, "JaFiz: aplicativo gamificado para apoio a rotina familiar,\nresponsabilidades e recompensas de criancas e adolescentes", size=22, bold=True, color=DARK_BLUE)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(40)
add_text(p, "Proposta de projeto para desenvolvimento de um sistema web voltado\na organizacao da rotina familiar e ao incentivo de habitos responsaveis.", size=12, italic=True, color=GRAY)
for label, value in [("Discente", "[NOME DO(A) DISCENTE]"), ("Orientador(a)", "[NOME DO(A) ORIENTADOR(A)]")]:
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(4)
    add_text(p, f"{label}: ", bold=True, color=DARK_BLUE)
    add_text(p, value)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(76)
add_text(p, "[CIDADE] - 2026", size=11, color=GRAY)

doc.add_page_break()

# Content
add_heading(doc, "1. Titulo do projeto")
add_body(doc, "JaFiz: desenvolvimento de um aplicativo web gamificado para organizacao de tarefas, acompanhamento de responsabilidades e educacao para autonomia no contexto familiar.")

add_heading(doc, "2. Tema e delimitacao")
add_body(doc, "O projeto investiga como um sistema web pode apoiar familias na organizacao de tarefas cotidianas de criancas e adolescentes. O recorte proposto contempla o desenvolvimento e a avaliacao preliminar do JaFiz, um aplicativo que permite cadastrar tarefas recorrentes, acompanhar seu cumprimento, registrar aprovacoes por responsaveis e calcular, ao final de cada mes, a recompensa financeira correspondente aos valores previamente acertados para as tarefas efetivamente realizadas.")
add_body(doc, "A proposta nao pretende substituir a mediacao familiar nem estabelecer regras universais de recompensa. O sistema sera tratado como uma ferramenta de apoio a comunicacao, transparencia e autonomia progressiva, com configuracoes adaptaveis a cada nucleo familiar.")

add_heading(doc, "3. Problema de pesquisa")
add_body(doc, "De que forma um aplicativo web gamificado, configuravel e mediado por responsaveis pode contribuir para tornar a rotina de tarefas familiares mais clara, acompanhavel e motivadora para criancas e adolescentes?")

add_heading(doc, "4. Justificativa")
add_body(doc, "A distribuicao de responsabilidades no ambiente familiar frequentemente depende de combinados verbais, lembrancas repetidas e registros dispersos. Esse processo dificulta a visualizacao das tarefas, gera conflitos sobre o que foi realizado e reduz oportunidades para que criancas compreendam a relacao entre compromisso, consequencia e conquista.")
add_body(doc, "O JaFiz surge como uma alternativa digital de baixo custo e uso simples. Ao reunir tarefas, horarios, confirmacoes, valores acordados, apuracao mensal e historico em um unico ambiente, a aplicacao pode favorecer a previsibilidade da rotina e oferecer feedback imediato. Ao final do mes, a crianca recebera a recompensa financeira calculada somente a partir das tarefas efetuadas e aprovadas, conforme os valores definidos pela familia. O uso de elementos de gamificacao deve ser empregado de maneira moderada, como suporte a motivacao e ao acompanhamento de metas, sempre com supervisao dos responsaveis.")
add_body(doc, "Do ponto de vista academico, o trabalho articula desenvolvimento web, experiencia do usuario, gamificacao e privacidade no contexto domestico. Do ponto de vista social, busca produzir um prototipo funcional que possa ser avaliado com usuarios representativos e evoluido a partir de suas necessidades.")

add_heading(doc, "5. Objetivos")
add_heading(doc, "5.1 Objetivo geral", 2)
add_body(doc, "Desenvolver e avaliar preliminarmente o JaFiz, um aplicativo web gamificado para apoiar a organizacao de tarefas, responsabilidades e recompensas no ambiente familiar.")
add_heading(doc, "5.2 Objetivos especificos", 2)
for item in [
    "Levantar requisitos funcionais e nao funcionais para o acompanhamento de rotinas familiares.",
    "Projetar uma interface acessivel e adequada aos perfis de responsavel e crianca/adolescente.",
    "Implementar recursos de cadastro de usuarios, tarefas recorrentes, confirmacao, aprovacao, valores financeiros por tarefa, apuracao mensal e historico.",
    "Definir regras configuraveis para calcular a recompensa financeira mensal com base nas tarefas efetuadas e aprovadas, preservando a mediacao dos responsaveis.",
    "Aplicar medidas basicas de seguranca e privacidade, com controle de acesso por perfil e tratamento adequado de dados pessoais.",
    "Realizar testes funcionais e uma avaliacao inicial de usabilidade com participantes voluntarios ou cenarios simulados.",
]: add_bullet(doc, item)

add_heading(doc, "6. Proposta de solucao")
add_body(doc, "O JaFiz sera estruturado como aplicacao web responsiva. Cada familia podera administrar seus perfis, atribuir tarefas por dia e horario, definir previamente o valor financeiro de cada tarefa e registrar a conclusao das atividades. Ao fim de cada mes, o sistema apurara o total das tarefas efetuadas e aprovadas, somando os valores acordados para indicar a recompensa financeira da crianca. O responsavel permanecera como agente de aprovacao das tarefas e de confirmacao da entrega da recompensa.")

table = doc.add_table(rows=1, cols=3)
set_borders(table); table_fixed(table, [2300, 3600, 3460])
headers = ["Modulo", "Funcionalidades previstas", "Beneficio esperado"]
mark_header_row(table.rows[0])
for cell, value in zip(table.rows[0].cells, headers):
    shade(cell, LIGHT); p=cell.paragraphs[0]; add_text(p, value, bold=True, color=DARK_BLUE)
for row in [
    ("Perfis", "Responsaveis e criancas com permissoes distintas.", "Acesso adequado a cada papel da familia."),
    ("Tarefas", "Cadastro, recorrencia, horarios, peso e status.", "Rotina visivel e combinados registrados."),
    ("Aprovacao", "Confirmacao pela crianca e aprovacao pelo responsavel.", "Transparencia sobre o que foi realizado."),
    ("Recompensa mensal", "Valores por tarefa, apuracao ao fim do mes e historico de entregas.", "Calculo transparente da recompensa financeira devida."),
    ("Dashboard", "Filtros, calendario e relatorios simples.", "Visao geral para tomada de decisao familiar."),
    ("Seguranca", "Autenticacao, sessoes e trilha basica de auditoria.", "Protecao e rastreabilidade das acoes."),
]:
    cells=table.add_row().cells
    for cell,value in zip(cells,row): add_text(cell.paragraphs[0], value)

add_heading(doc, "7. Metodologia")
add_body(doc, "A pesquisa sera de natureza aplicada, com abordagem predominantemente qualitativa e carater exploratorio. O percurso combina levantamento bibliografico, analise de requisitos, prototipacao, implementacao incremental e avaliacao preliminar do artefato desenvolvido.")
for item in [
    "Revisao bibliografica sobre gamificacao, formacao de habitos, experiencia do usuario e protecao de dados de criancas e adolescentes.",
    "Levantamento de requisitos a partir do problema, de entrevistas ou conversas guiadas com familias voluntarias, quando viavel, e de analise de cenarios de uso.",
    "Modelagem das regras de negocio, fluxos de navegacao e prototipos de interface.",
    "Desenvolvimento do sistema com ciclos curtos de implementacao e testes funcionais.",
    "Avaliacao preliminar de usabilidade por tarefas, observacao e questionario de percepcao, respeitando consentimento e anonimato dos participantes.",
]: add_number(doc, item)

add_heading(doc, "8. Tecnologias e requisitos tecnicos")
add_body(doc, "A versao atual do projeto utiliza JavaScript no servidor, uma interface web em HTML, CSS e JavaScript e banco de dados PostgreSQL quando hospedado. A arquitetura sera evoluida para separar configuracoes sensiveis do codigo, assegurar persistencia confiavel e permitir implantacao em ambiente de producao.")
for item in ["Aplicacao web responsiva para navegadores modernos.", "Controle de acesso por perfil e armazenamento seguro de senhas.", "Persistencia em banco de dados relacional e rotinas de backup.", "Registro de acoes relevantes para auditoria basica.", "Testes de API e dos fluxos principais de utilizacao."]: add_bullet(doc,item)

add_heading(doc, "9. Aspectos eticos e de privacidade")
add_body(doc, "Como o sistema podera tratar dados de menores de idade, o projeto adotara o principio da minimizacao de dados: somente informacoes necessarias ao funcionamento serao coletadas. Qualquer avaliacao com participantes dependera de consentimento do responsavel, comunicacao clara sobre a finalidade do estudo, uso de dados anonimizados nos resultados e possibilidade de desistir a qualquer momento. Nao serao divulgados nomes, credenciais ou historicos individuais.")

add_heading(doc, "10. Cronograma preliminar")
table = doc.add_table(rows=1, cols=4)
set_borders(table); table_fixed(table,[4100,1750,1750,1760])
for cell,value in zip(table.rows[0].cells,["Etapa","Mes 1","Mes 2","Mes 3"]):
    shade(cell,LIGHT); add_text(cell.paragraphs[0],value,bold=True,color=DARK_BLUE)
mark_header_row(table.rows[0])
for row in [
    ("Revisao bibliografica e definicao do escopo","X","X",""),
    ("Levantamento de requisitos e prototipacao","X","X",""),
    ("Implementacao e testes funcionais","","X","X"),
    ("Avaliacao preliminar de usabilidade","","","X"),
    ("Analise dos resultados e redacao final","","","X"),
]:
    cells=table.add_row().cells
    for cell,value in zip(cells,row):
        p=cell.paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.CENTER if cell != cells[0] else WD_ALIGN_PARAGRAPH.LEFT; add_text(p,value)

add_heading(doc, "11. Resultados esperados")
for item in [
    "Um prototipo web funcional para gestao de rotinas familiares e apuracao de recompensa financeira mensal.",
    "Documentacao dos requisitos, regras de negocio e decisoes tecnicas do sistema.",
    "Evidencias iniciais de usabilidade, pontos de melhoria e limites da proposta.",
    "Uma contribuicao pratica para discussao sobre tecnologia, autonomia e mediacao familiar.",
]: add_bullet(doc,item)

add_heading(doc, "12. Referencias preliminares")
refs = [
    "DECI, E. L.; RYAN, R. M. The \"what\" and \"why\" of goal pursuits: human needs and the self-determination of behavior. Psychological Inquiry, v. 11, n. 4, p. 227-268, 2000.",
    "Deterding, S. et al. From game design elements to gamefulness: defining \"gamification\". Proceedings of the 15th International Academic MindTrek Conference, 2011.",
    "FOGG, B. J. A behavior model for persuasive design. Proceedings of the 4th International Conference on Persuasive Technology, 2009.",
    "NIELSEN, J. Usability engineering. San Francisco: Morgan Kaufmann, 1994.",
    "BRASIL. Lei n. 13.709, de 14 de agosto de 2018. Lei Geral de Protecao de Dados Pessoais (LGPD). Brasilia, DF, 2018.",
]
for ref in refs:
    p=doc.add_paragraph(style="Normal"); p.paragraph_format.left_indent=Inches(.25); p.paragraph_format.first_line_indent=Inches(-.25); p.paragraph_format.space_after=Pt(5); add_text(p,ref,size=10)

# Footer with page field
footer = section.footer
p = footer.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
add_text(p, "Proposta preliminar de TCC | JaFiz | ", size=9, color=GRAY)
r = p.add_run(); set_font(r,size=9,color=GRAY)
fld = OxmlElement("w:fldSimple"); fld.set(qn("w:instr"), "PAGE"); r._r.addnext(fld)

doc.core_properties.title = "Proposta preliminar de TCC - JaFiz"
doc.core_properties.subject = "Projeto de TCC"
doc.core_properties.author = "[NOME DO(A) DISCENTE]"
doc.save(OUT)
print(OUT)
