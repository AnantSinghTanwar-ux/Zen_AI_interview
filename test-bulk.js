const fs = require('fs');

async function test() {
  const formData = new FormData();
  formData.append('jobId', 't0BH2dG71pLRZudlCuIq');
  formData.append('topN', '5');
  
  // Create a dummy pdf file since docx extraction might be failing
  fs.writeFileSync('dummy.pdf', 'Anant Singh Tanwar Resume. Frontend Developer. React, Next.js, Node.js.');
  const blob = new Blob([fs.readFileSync('dummy.pdf')], { type: 'application/pdf' });
  formData.append('files', blob, 'dummy.pdf');

  try {
    const res = await fetch('http://localhost:3000/api/v2/screening/bulk-upload', {
      method: 'POST',
      body: formData
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch(e) {
    console.error(e);
  }
}
test();
