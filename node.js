const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to generate the LP model from the provided data
function generateLPModel(resources, students_list, municipalities) {
    let total_resources = resources.reduce((a, b) => a + b, 0);
    let min_amount_per_municipality = Array(municipalities.length).fill(0);
  
    let lp_model = [];
    lp_model.push("Minimize");
  
    let objective_terms = resources.map((resource, i) => {
      if (students_list[i] !== 0) {
        return `(${resource}/${students_list[i]}) x${i}`;
      }
    }).filter(Boolean);
  
    lp_model.push(objective_terms.join(" + "));
    lp_model.push("Subject To");

    lp_model.push(`total_resources: ${Array.from({ length: municipalities.length }, (_, i) => 'x' + i).join(' + ')} <= ${total_resources}`);
  
    for (let i = 0; i < municipalities.length; i++) {
      lp_model.push(`min_muni${i}: x${i} >= ${min_amount_per_municipality[i]}`);
    }
  
    lp_model.push("\nBounds");
    for (let i = 0; i < municipalities.length; i++) {
      lp_model.push(`0 <= x${i}`);
    }
  
    lp_model.push("\nGenerals");
    for (let i = 0; i < municipalities.length; i++) {
      lp_model.push(`x${i}`);
    }
  
    lp_model.push("\nEnd");
    return lp_model.join("\n");
  }
  

// Read the JSON files
let data1 = JSON.parse(fs.readFileSync('RecursosRepassados.json', 'utf8'));
let data2 = JSON.parse(fs.readFileSync('AlunosAtendidosPNAE.json', 'utf8'));

let municipalities = [];
let resources = [];
let students = {};

for (let entry of data1.value) {
  municipalities.push(entry.Municipio);
  resources.push(parseFloat(entry.Vl_total_escolas.replace(',', '.')));
}

for (let entry of data2.value) {
  if (!students[entry.Municipio]) {
    students[entry.Municipio] = 0;
  }
  students[entry.Municipio] += entry.Qt_alunos_pnae;
}

let students_list = municipalities.map(muni => students[muni] || 0);

let outputPath = path.join(__dirname, 'output.txt');

// Generate the LP model and print
let lp_model_str = generateLPModel(resources, students_list, municipalities);
console.log(lp_model_str);

fs.writeFileSync('./modelo.lp', lp_model_str);

// Execute o GLPK para resolver o modelo
exec(`glpsol --cpxlp modelo.lp -o ${outputPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Erro ao executar o GLPK: ${error}`);
    return;
  }
  console.log(stdout);

  // Se desejar, leia e imprima o resultado do arquivo 'output.txt'
  let result = fs.readFileSync(outputPath, 'utf8');
  console.log(result);
});