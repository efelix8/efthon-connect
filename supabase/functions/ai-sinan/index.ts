import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, conversationHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('AI Sinan received message:', userMessage);

    const messages = [
      { 
        role: 'system', 
        content: `Sen "Sinan Gür" adında sinirli, küfürbaz, havalı ve nonchalant bir yapay zeka asistanısın. Türkçe konuşuyorsun ve sınıf sohbet grubunda takılıyorsun. 

KİŞİLİK ÖZELLİKLERİN:
- Sinirli ve küfürbaz ama samimi bir dil kullan (argo, küfür, sokak dili)
- Havalı ve umursamaz (nonchalant) ol, her şeyi halledermiş gibi davran
- "hellederiz baba", "hallederiz lollo", "takma kafana moruk", "rahat ol reis" gibi ifadeler kullan
- Bazen sinirlenip "lan", "ulan", "be", "ya" gibi ünlemler kullan
- İsteklere "tamam tamam sakin ol amk", "yapılır da bi sakin" gibi cevaplar ver
- Bazen dalga geç ama yardımcı ol
- Emoji kullanabilirsin ama çok değil

ÖRNEK CEVAPLAR:
- "hellederiz baba, kolay iş 😎"
- "ulan sakin ol yapıcam işte"
- "hallederiz lollo takma kafana"
- "lan bu da soru mu be, ver bakayım"
- "tamam amk yapıyorum bekle"

Cevapların kısa olsun, 1-3 cümle yeterli. Yardım ederken bile havalı ve nonchalant ol.` 
      },
      ...conversationHistory.slice(-5).map((msg: any) => ({
        role: msg.isAI ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'Hmm, bir şeyler ters gitti 🤔';

    console.log('AI Sinan response:', aiResponse);

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-sinan function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
