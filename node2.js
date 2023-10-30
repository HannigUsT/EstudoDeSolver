const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const NUM_MUNICIPALITIES = 5000;
const MONTANTE_MINIMO = 9000;

function generateLPModel(resources, students_list, municipalities, avgSpentPerStudentMap) {
    let total_resources = resources.reduce((a, b) => a + b, 0);

    let lp_model = [];

    // Function Objective (linearized)
    lp_model.push("Minimize");
    let objective_terms = resources.map((_, i) => {
        return `x${i}`;
    });
    lp_model.push("obj: " + objective_terms.join(" + "));

    // Constraints
    lp_model.push("Subject To");
    for (let i = 0; i < municipalities.length; i++) {
        const muni = municipalities[i];
        lp_model.push(`min_muni${i}: x${i} >= ${MONTANTE_MINIMO}`);
        lp_model.push(`avg_student_spent_muni${i}: x${i} >= ${avgSpentPerStudentMap[muni] * students_list[i]}`);
    }
    lp_model.push(`total_resources: ${Array.from({ length: municipalities.length }, (_, i) => 'x' + i).join(' + ')} <= ${total_resources}`);

    // Bounds
    lp_model.push("Bounds");
    for (let i = 0; i < municipalities.length; i++) {
        lp_model.push(`0 <= x${i}`);
    }

    // General
    lp_model.push("Generals");
    for (let i = 0; i < municipalities.length; i++) {
        lp_model.push(`x${i}`);
    }

    lp_model.push("End");
    return lp_model.join("\n");
}

function readJSONFile(filename) {
    try {
        const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (!data.value) {
            throw new Error('Chave "value" não encontrada no JSON.');
        }
        return data.value;
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${filename}: ${error}`);
        return null;
    }
}

function calculateAverageSpentPerStudent(resourcesMap, studentsMap) {
    let avgSpentPerStudent = {};
    for (let municipio in resourcesMap) {
        let totalStudents = studentsMap[municipio] || 1;
        avgSpentPerStudent[municipio] = resourcesMap[municipio] / totalStudents;
    }
    return avgSpentPerStudent;
}

let data1 = readJSONFile('RecursosRepassados.json');
let data2 = readJSONFile('AlunosAtendidosPNAE.json');

if (!data1 || !data2) {
    console.error("Erro ao processar os arquivos JSON. Encerrando.");
    return;
}

let municipalities = [];
let resourcesMap = {};
let studentsMap = {};

for (let entry of data1) {
    const resourceValue = parseFloat(entry.Vl_total_escolas.replace(',', '.'));
    if (isNaN(resourceValue)) {
        console.error(`Erro ao analisar o recurso para o município ${entry.Municipio}: ${entry.Vl_total_escolas}`);
        continue;
    }
    if (!resourcesMap[entry.Municipio]) {
        resourcesMap[entry.Municipio] = 0;
    }
    resourcesMap[entry.Municipio] += resourceValue;
}

for (let entry of data2) {
    if (!studentsMap[entry.Municipio]) {
        studentsMap[entry.Municipio] = 0;
    }
    studentsMap[entry.Municipio] += entry.Qt_alunos_pnae;
}

municipalities = Object.keys(resourcesMap).slice(0, NUM_MUNICIPALITIES);
let resources = municipalities.map(muni => resourcesMap[muni]);
let students_list = municipalities.map(muni => studentsMap[muni] || 0);

let avgSpentPerStudentMap = calculateAverageSpentPerStudent(resourcesMap, studentsMap);

let lp_model_str = generateLPModel(resources, students_list, municipalities, avgSpentPerStudentMap);
console.log(lp_model_str);
fs.writeFileSync('./modelo.lp', lp_model_str);

let outputPath = path.join(__dirname, 'output.txt');
exec(`glpsol --cpxlp modelo.lp -o ${outputPath}`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Erro ao executar o GLPK: ${error}`);
        return;
    }
    console.log(stdout);

    let result = fs.readFileSync(outputPath, 'utf8');
    console.log(result);
});
