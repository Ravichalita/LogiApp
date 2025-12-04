
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-muted/30 py-8 md:py-12">
        <div className="container mx-auto max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">Política de Privacidade – LogiApp</CardTitle>
                    <p className="text-sm text-muted-foreground pt-1">Última atualização: 25 de setembro de 2025</p>
                </CardHeader>
                <CardContent className="space-y-6 text-foreground/90">
                    <p>
                        Bem-vindo ao LogiApp (<a href="https://logi.app.br" className="text-primary hover:underline">https://logi.app.br</a>).
                        Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos os dados pessoais de nossos usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018) e demais legislações aplicáveis.
                    </p>
                    <p>
                        O LogiApp é um sistema web desenvolvido para empresas que operam frotas de caminhões vácuo (sewer-jet) e caminhões poliguindaste (aluguel de caçambas de entulho), com o objetivo de otimizar a gestão logística e operacional de seus serviços.
                    </p>

                    <Separator />

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">1. Dados Coletados</h2>
                        <p>Ao utilizar o LogiApp, podemos coletar as seguintes informações:</p>
                        <ul className="list-disc space-y-1 pl-6">
                            <li><strong>Dados de autenticação:</strong> Nome, e-mail e foto de perfil quando o usuário opta por login via Google OAuth.</li>
                            <li><strong>Dados de uso do sistema:</strong> Informações inseridas pela empresa usuária para gestão de sua frota: dados de motoristas, veículos, clientes, ordens de serviço e rotas.</li>
                            <li><strong>Dados técnicos:</strong> Endereço IP, tipo de navegador, dispositivo, data e hora de acesso, cookies e identificadores únicos para fins de segurança e melhoria da experiência.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold font-headline">1.1 Uso de Dados do Usuário Google</h3>
                        <p>
                            Em conformidade com as diretrizes de dados do usuário do Google, declaramos explicitamente que, ao optar pelo login via Google (Google OAuth), o LogiApp acessa, usa, armazena e compartilha os dados do usuário Google da seguinte maneira:
                        </p>
                        <ul className="list-disc space-y-1 pl-6">
                            <li><strong>Acesso:</strong> Acessamos apenas o seu nome, endereço de e-mail e foto de perfil fornecidos pela API do Google. Também podemos solicitar acesso ao seu Google Calendar para sincronizar agendamentos, caso você ative essa funcionalidade.</li>
                            <li><strong>Uso:</strong> Utilizamos esses dados estritamente para autenticar sua identidade no sistema, criar seu perfil de usuário e, se autorizado, gerenciar eventos no seu calendário.</li>
                            <li><strong>Armazenamento:</strong> Armazenamos seu nome, e-mail e URL da foto em nosso banco de dados seguro para manter sua sessão ativa e identificar suas ações no sistema.</li>
                            <li><strong>Compartilhamento:</strong> Não compartilhamos seus dados de usuário Google com terceiros, exceto com o próprio Google para fins de validação de login e integração de calendário.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">2. Finalidade do Tratamento</h2>
                        <p>Os dados coletados são utilizados para:</p>
                         <ul className="list-disc space-y-1 pl-6">
                            <li>Autenticar e permitir o acesso seguro ao sistema.</li>
                            <li>Gerenciar operações logísticas de frotas de caminhões e caçambas.</li>
                            <li>Melhorar a performance, usabilidade e segurança do aplicativo.</li>
                            <li>Cumprir obrigações legais e regulatórias.</li>
                            <li>Não utilizamos dados pessoais para fins de marketing sem o consentimento explícito do usuário.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">3. Compartilhamento de Dados</h2>
                        <p>O LogiApp não vende nem compartilha dados pessoais com terceiros para fins comerciais. Podemos compartilhar informações apenas:</p>
                        <ul className="list-disc space-y-1 pl-6">
                            <li>Com provedores de serviços essenciais para funcionamento da plataforma (ex.: servidores de hospedagem, banco de dados, serviços de autenticação Google).</li>
                            <li>Quando exigido por lei, ordem judicial ou solicitação de autoridades competentes.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">4. Armazenamento e Segurança</h2>
                         <ul className="list-disc space-y-1 pl-6">
                            <li>Os dados são armazenados em servidores seguros, com uso de criptografia, firewalls e controles de acesso.</li>
                            <li>Apenas pessoas autorizadas têm acesso restrito aos dados pessoais.</li>
                            <li>Mantemos logs de acesso para auditoria e segurança.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">5. Direitos dos Titulares (LGPD)</h2>
                        <p>De acordo com a LGPD, os usuários têm o direito de:</p>
                         <ul className="list-disc space-y-1 pl-6">
                            <li>Confirmar a existência de tratamento de dados.</li>
                            <li>Acessar, corrigir ou atualizar suas informações.</li>
                            <li>Solicitar a portabilidade dos dados.</li>
                            <li>Solicitar a exclusão de dados pessoais, quando aplicável.</li>
                            <li>Revogar consentimentos previamente fornecidos.</li>
                            <li>Solicitações podem ser feitas pelo e-mail de contato informado abaixo.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">6. Retenção de Dados</h2>
                         <ul className="list-disc space-y-1 pl-6">
                           <li>Os dados são mantidos apenas pelo período necessário para cumprimento das finalidades descritas nesta política.</li>
                           <li>Após esse período, os dados podem ser anonimizados ou excluídos de forma segura.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">7. Cookies e Tecnologias Semelhantes</h2>
                        <p>Utilizamos cookies para:</p>
                         <ul className="list-disc space-y-1 pl-6">
                           <li>Lembrar preferências de acesso.</li>
                           <li>Melhorar a performance e personalização da experiência.</li>
                           <li>Coletar dados estatísticos de uso da plataforma.</li>
                           <li>O usuário pode gerenciar cookies diretamente em seu navegador.</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">8. Alterações na Política de Privacidade</h2>
                        <p>Esta política pode ser atualizada periodicamente. Sempre que houver mudanças relevantes, notificaremos os usuários pelo site ou e-mail cadastrado.</p>
                        <p className="mt-2"><strong>Aviso sobre Dados do Google:</strong> Caso haja qualquer alteração na forma como acessamos, usamos ou compartilhamos seus dados de usuário Google, você será notificado com destaque e solicitaremos seu novo consentimento, se aplicável.</p>
                    </div>

                     <div className="space-y-2">
                        <h2 className="text-xl font-semibold font-headline">9. Contato</h2>
                        <p>Para dúvidas, solicitações ou exercício de direitos previstos na LGPD, entre em contato:</p>
                        <p>📧 ravichalita@gmail.com</p>
                    </div>

                </CardContent>
            </Card>
        </div>
    </div>
  );
}
