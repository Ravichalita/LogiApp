
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TermsOfServicePage() {
  return (
    <div className="bg-muted/30 py-8 md:py-12">
        <div className="container mx-auto max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">Termos de Serviço – LogiApp</CardTitle>
                    <p className="text-sm text-muted-foreground pt-1">Última atualização: 25 de setembro de 2025</p>
                </CardHeader>
                <CardContent className="space-y-6 text-foreground/90">
                    <p>
                        Bem-vindo ao LogiApp (<a href="https://logi.app.br" className="text-primary hover:underline">https://logi.app.br</a>).
                        Ao acessar ou utilizar o sistema, você concorda com os presentes Termos de Serviço. Leia-os atentamente, pois eles estabelecem os direitos e obrigações entre você (usuário) e o LogiApp.
                    </p>

                    <Separator />

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">1. Definições</h2>
                        <ul className="list-disc space-y-1 pl-6">
                            <li><strong>LogiApp:</strong> Plataforma web de gestão logística para empresas que utilizam frotas de caminhões vácuo (sewer-jet) e poliguindaste (aluguel de caçambas).</li>
                            <li><strong>Usuário:</strong> Pessoa física ou jurídica que acessa e utiliza o sistema.</li>
                            <li><strong>Conta:</strong> Credencial de acesso criada pelo usuário, podendo ser vinculada ao login via Google OAuth.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">2. Condições de Uso</h2>
                        <ul className="list-disc space-y-1 pl-6">
                            <li>O usuário deve fornecer informações verdadeiras e manter seus dados atualizados.</li>
                            <li>O acesso ao LogiApp é restrito a maiores de 18 anos ou a pessoas jurídicas representadas legalmente.</li>
                            <li>O usuário é responsável por manter a confidencialidade de suas credenciais de acesso.</li>
                            <li>É proibido utilizar o sistema para fins ilícitos, fraudulentos ou que violem direitos de terceiros.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">3. Licença de Uso</h2>
                        <p>O LogiApp concede ao usuário uma licença limitada, não exclusiva e intransferível para acessar e utilizar a plataforma, exclusivamente para gestão logística. É vedado:</p>
                        <ul className="list-disc space-y-1 pl-6">
                           <li>Reproduzir, modificar ou redistribuir o software sem autorização.</li>
                           <li>Utilizar engenharia reversa, hacks ou qualquer tentativa de acesso indevido.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">4. Dados e Privacidade</h2>
                        <ul className="list-disc space-y-1 pl-6">
                            <li>O tratamento de dados pessoais segue a nossa <a href="/privacy-policy" className="text-primary hover:underline">Política de Privacidade</a>.</li>
                            <li>O usuário é responsável pelas informações inseridas no sistema, incluindo dados de clientes, motoristas e veículos.</li>
                            <li>O LogiApp adota medidas de segurança para proteção das informações, mas não pode garantir proteção absoluta contra incidentes externos.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">5. Obrigações do Usuário</h2>
                         <ul className="list-disc space-y-1 pl-6">
                           <li>Utilizar o sistema de acordo com a legislação vigente, especialmente a LGPD.</li>
                           <li>Manter backups de informações relevantes inseridas na plataforma.</li>
                           <li>Comunicar imediatamente qualquer uso não autorizado da conta.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">6. Responsabilidades do LogiApp</h2>
                        <p>O LogiApp compromete-se a:</p>
                         <ul className="list-disc space-y-1 pl-6">
                           <li>Disponibilizar a plataforma de forma estável e segura, salvo em casos de manutenção, atualização ou força maior.</li>
                           <li>Proteger os dados conforme padrões de segurança adequados.</li>
                           <li>Informar os usuários sobre alterações relevantes nos Termos de Serviço ou na Política de Privacidade.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">7. Limitação de Responsabilidade</h2>
                        <p>O LogiApp não se responsabiliza por:</p>
                         <ul className="list-disc space-y-1 pl-6">
                           <li>Danos decorrentes de uso indevido do sistema pelo usuário.</li>
                           <li>Perdas causadas por falhas de conexão à internet, indisponibilidade temporária do servidor ou eventos de força maior.</li>
                           <li>Decisões comerciais ou operacionais tomadas a partir de informações lançadas no sistema.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">8. Modificações no Serviço</h2>
                        <p>O LogiApp pode atualizar, modificar ou descontinuar funcionalidades, mediante aviso prévio aos usuários.</p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">9. Rescisão</h2>
                         <ul className="list-disc space-y-1 pl-6">
                           <li>O usuário pode encerrar sua conta a qualquer momento.</li>
                           <li>O LogiApp pode suspender ou encerrar contas que violem estes Termos de Serviço ou a legislação vigente.</li>
                        </ul>
                    </div>
                    
                     <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">10. Alterações nos Termos</h2>
                        <p>Os Termos podem ser revisados periodicamente. Caso ocorram alterações relevantes, os usuários serão notificados por meio da plataforma ou do e-mail cadastrado.</p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">11. Foro e Legislação Aplicável</h2>
                        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de [cidade da sede da empresa responsável pelo LogiApp], com renúncia a qualquer outro, para dirimir controvérsias decorrentes destes Termos.</p>
                    </div>

                     <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">12. Contato</h2>
                        <p>Em caso de dúvidas ou solicitações, entre em contato:</p>
                        <p>📧 ravichalita@gmail.com</p>
                    </div>

                </CardContent>
            </Card>
        </div>
    </div>
  );
}
