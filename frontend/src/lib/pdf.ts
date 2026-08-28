import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PRIMARY_COLOR = [22, 163, 74]; // green-600
const TEXT_COLOR = [51, 65, 85]; // slate-700

export const generateLoanTerm = (client: any, loan: any, installments: any[]): string => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Luck Cred', 14, 22);

  doc.setFontSize(14);
  doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
  doc.text('Termo de Ciência e Empréstimo', 14, 32);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 40);

  // Client Details
  doc.setFont('helvetica', 'bold');
  doc.text('1. DADOS DO CLIENTE', 14, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${client.name}`, 14, 62);
  doc.text(`Documento: ${client.document || 'Não informado'}`, 14, 68);
  doc.text(`Telefone: ${client.phone}`, 14, 74);

  // Loan Details
  doc.setFont('helvetica', 'bold');
  doc.text('2. RESUMO DA OPERAÇÃO', 14, 89);
  doc.setFont('helvetica', 'normal');
  doc.text(`Valor Principal: R$ ${Number(loan.amount).toFixed(2)}`, 14, 96);
  doc.text(`Taxa de Juros: ${loan.interest_rate}%`, 14, 102);
  doc.text(`Valor Total a Pagar: R$ ${Number(loan.total_amount).toFixed(2)}`, 14, 108);
  doc.text(`Quantidade de Parcelas: ${loan.installments_count}x`, 14, 114);

  // Schedule Table
  doc.setFont('helvetica', 'bold');
  doc.text('3. CRONOGRAMA DE PAGAMENTO', 14, 129);
  
  const tableData = installments.map(inst => [
    `${inst.installment_number}ª Parcela`,
    new Date(inst.due_date + 'T00:00:00').toLocaleDateString('pt-BR'),
    `R$ ${Number(inst.total_amount).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 135,
    head: [['Parcela', 'Vencimento', 'Valor']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR as [number, number, number] },
    styles: { fontSize: 9 }
  });

  // Terms
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFont('helvetica', 'bold');
  doc.text('4. TERMO DE CIÊNCIA E ACEITE DIGITAL', 14, finalY);
  doc.setFont('helvetica', 'normal');
  
  const termsText = `Pelo presente instrumento, reconheço e declaro ciência do valor principal recebido, bem como dos juros acordados e do fluxo de pagamento estipulado no cronograma acima. Comprometo-me a realizar os pagamentos nas datas de vencimento indicadas.

Fica acordado que o aceite digital formalizado via aplicativo de mensagens (WhatsApp), acompanhado de uma vídeo-selfie de confirmação, possui plena validade jurídica como assinatura e confissão desta dívida.

FRASE PARA LEITURA NO VÍDEO-SELFIE:
"Eu, ${client.name}, documento ${client.document || 'informado no cadastro'}, concordo com o empréstimo da Luck Cred no valor de R$ ${Number(loan.amount).toFixed(2)} e afirmo que vou pagar as parcelas nas datas combinadas."`;
  
  doc.setFontSize(9);
  const splitText = doc.splitTextToSize(termsText, 180);
  doc.text(splitText, 14, finalY + 7);

  // Signature
  const signatureY = finalY + 50;
  doc.line(40, signatureY, 170, signatureY);
  doc.text(client.name, 105, signatureY + 5, { align: 'center' });
  doc.text('Assinatura Física (Opcional caso haja envio da Vídeo-Selfie)', 105, signatureY + 10, { align: 'center' });

  // Return base64 string
  return doc.output('datauristring');
};

export const generateReceipt = (client: any, installment: any, receiptDate: string): string => {
  const doc = new jsPDF();
  
  doc.setFontSize(22);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Luck Cred', 14, 22);

  doc.setFontSize(16);
  doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
  doc.text('RECIBO DE PAGAMENTO', 14, 32);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número do Recibo: REC-${installment.id.substring(0, 8).toUpperCase()}`, 14, 45);
  doc.text(`Data do Pagamento: ${new Date(receiptDate).toLocaleString('pt-BR')}`, 14, 52);

  doc.setFontSize(11);
  const text = `Recebemos de ${client.name} (Documento: ${client.document || 'Não informado'}), a quantia de R$ ${Number(installment.total_amount).toFixed(2)}, referente ao pagamento da Parcela ${installment.installment_number} com vencimento original em ${new Date(installment.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}.`;
  
  const splitText = doc.splitTextToSize(text, 180);
  doc.text(splitText, 14, 70);

  doc.text('Para maior clareza, firmamos o presente recibo.', 14, 90);

  doc.line(40, 130, 170, 130);
  doc.text('Luck Cred - Assinatura do Emissor', 105, 136, { align: 'center' });

  return doc.output('datauristring');
};

export const downloadBase64PDF = (base64String: string, filename: string) => {
  const link = document.createElement('a');
  link.href = base64String;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
