import './style.css'
import { db } from './firebase.js'
import { ref, set, push, get, onValue, update } from 'firebase/database'

// 전역 상태 관리
const appState = {
  currentStage: 0,
  studentName: '',
  apiKeyStatus: 'checking',
  parkingData: null,
  cctvData: null,
  answers: {},
  proposal: {
    problem: '',
    solution: '',
    reason: ''
  },
  aiFeedback: '',
  allProposals: [],
  votes: {},
  dashboard: null,
  questionAnswers: {
    question1: null,
    question2: null,
    question1Correct: null,
    question2Correct: null
  }
}

// CSV 파싱 함수
async function parseCSV(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`CSV 파일을 불러올 수 없습니다: ${response.status} ${response.statusText}`)
    }
    const text = await response.text()
    if (!text || text.trim().length === 0) {
      throw new Error('CSV 파일이 비어있습니다.')
    }
    const lines = text.trim().split('\n')
    if (lines.length === 0) {
      throw new Error('CSV 파일에 데이터가 없습니다.')
    }
    const headers = lines[0].split(',')
    const data = []
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',')
        const obj = {}
        headers.forEach((header, index) => {
          obj[header.trim()] = values[index]?.trim() || ''
        })
        data.push(obj)
      }
    }
    return data
  } catch (error) {
    console.error(`CSV 파싱 오류 (${url}):`, error)
    throw error
  }
}

// API Key 확인
async function checkAPIKey() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey) {
    appState.apiKeyStatus = 'disconnected'
    return false
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
    if (response.ok) {
      appState.apiKeyStatus = 'connected'
      return true
    } else {
      appState.apiKeyStatus = 'disconnected'
      return false
    }
  } catch (error) {
    appState.apiKeyStatus = 'disconnected'
    return false
  }
}

// OpenAI API 호출
async function callOpenAI(prompt, systemPrompt = '') {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('API Key가 설정되지 않았습니다.')
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'API 호출 실패')
    }
    
    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error('OpenAI API 호출 오류:', error)
    throw error
  }
}

// 메인 렌더링 함수
async function renderApp() {
  const app = document.querySelector('#app')
  
  const stageContent = await renderCurrentStage()
  
  app.innerHTML = `
    <div class="api-status ${appState.apiKeyStatus}">
      API Key: ${appState.apiKeyStatus === 'connected' ? '정상 작동 중' : 
                appState.apiKeyStatus === 'checking' ? '확인 중...' : '연결 실패'}
    </div>
    
    ${stageContent}
  `
  
  attachEventListeners()
}

// 현재 단계 렌더링
async function renderCurrentStage() {
  switch (appState.currentStage) {
    case 0: return renderStage0()
    case 1: return renderStage1()
    case 2: return renderStage2()
    case 3: return renderStage3()
    case 4: return renderStage4()
    case 5: return await renderStage5()
    case 6: return await renderStage6()
    case 7: return await renderStage7()
    case 8: return await renderAdminStage()
    default: return renderStage0()
  }
}

// 0단계: 이름 입력 및 시작
function renderStage0() {
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">🏛️ 최고의 동작구청장 후보는 누구?</h1>
        <p class="stage-subtitle">동작구청장 후보 캠프에 참여하신 여러분, 환영합니다!</p>
      </div>
      <div style="text-align: center; padding: 40px;">
        <p style="font-size: 1.2em; margin-bottom: 30px; line-height: 1.8; color: var(--winter-blue-700);">
          동작구에 있는 우리 학교 주변 문제를 먼저 해결할 수 있어야겠죠?<br>
          지난 시간에 고른 주차문제를 해결하는 방안을 제시하고,<br>
          투표를 통해 제일 좋은 해결방안을 골라봅시다.
        </p>
        <div class="input-group">
          <label class="input-label">이름을 입력해주세요</label>
          <input type="text" id="student-name" class="input-field" placeholder="이름을 입력하세요" 
                 value="${appState.studentName}" maxlength="20">
        </div>
        <button class="btn btn-success" id="start-btn" ${appState.studentName ? '' : 'disabled'}>
          시작하기 🚀
        </button>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px dashed var(--winter-blue-300);">
          <button class="btn" id="admin-btn" style="background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%); color: white;">
            👨‍🏫 교사/관리자 페이지
          </button>
        </div>
      </div>
    </div>
  `
}

// 1단계: 문제 파악하기 - 데이터 시각화
function renderStage1() {
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">📊 1단계: 문제 파악하기!</h1>
        <p class="stage-subtitle">데이터를 시각화해서 보면서 문제를 파악해봅시다</p>
      </div>
      
      <div class="question-card" style="margin-bottom: 30px;">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 20px;">📄 가정통신문</h3>
        <img src="/가정통신문.PNG" alt="가정통신문" class="content-image" style="max-width: 100%; border: 2px solid var(--winter-blue-200); border-radius: 10px; box-shadow: 0 4px 12px var(--winter-shadow);">
      </div>
      
      <div class="question-card" style="margin-bottom: 30px; background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); border-left: 5px solid #ff9800;">
        <div class="question-title">가정통신문을 읽고 문제를 풀어보세요</div>
        <p style="margin: 20px 0; font-size: 1.1em; line-height: 1.8;">
          이 가정통신문은 <span id="letter-problem-answer" style="min-width: 200px; display: inline-block; padding: 10px; border: 2px dashed var(--winter-blue-300); border-radius: 8px; background: white; min-height: 40px; vertical-align: middle;">
            ${appState.answers.letterProblem || '여기에 드래그하세요'}
          </span> 에 대한 내용입니다.
        </p>
        
        <div style="margin-top: 30px;">
          <p style="font-weight: 600; margin-bottom: 15px; color: var(--winter-blue-700);">보기 (드래그해서 위 빈칸에 넣어주세요):</p>
          <div id="letter-options" style="display: flex; gap: 15px; flex-wrap: wrap;">
            <div class="draggable-option" draggable="true" data-option="쓰레기 투기 문제" 
                 style="padding: 15px 25px; background: white; border: 2px solid var(--winter-blue-300); border-radius: 10px; cursor: grab; font-size: 1.1em; transition: all 0.3s;">
              1) 쓰레기 투기 문제
            </div>
            <div class="draggable-option" draggable="true" data-option="불법 주정차 문제" 
                 style="padding: 15px 25px; background: white; border: 2px solid var(--winter-blue-300); border-radius: 10px; cursor: grab; font-size: 1.1em; transition: all 0.3s;">
              2) 불법 주정차 문제
            </div>
            <div class="draggable-option" draggable="true" data-option="환경오염문제" 
                 style="padding: 15px 25px; background: white; border: 2px solid var(--winter-blue-300); border-radius: 10px; cursor: grab; font-size: 1.1em; transition: all 0.3s;">
              3) 환경오염문제
            </div>
          </div>
        </div>
        
        <div id="letter-feedback" style="margin-top: 20px; font-weight: 600;"></div>
      </div>
      
      <div class="question-card" style="margin-bottom: 30px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-left: 5px solid var(--winter-blue-500);">
        <p style="font-size: 1.2em; color: var(--winter-blue-700); line-height: 1.8; font-weight: 600;">
          우리학교뿐만 아니라, 불법 주정차 문제는 동작구에서도 문제입니다. 그래프를 보고 문제를 풀어보세요.
        </p>
      </div>
      
      <div class="chart-container">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 20px;">연도별 불법 주정차 민원 현황</h3>
        <canvas id="line-chart"></canvas>
      </div>
      
      <div class="chart-container">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 20px;">2024년 월별 불법 주정차 민원 현황</h3>
        <canvas id="bar-chart"></canvas>
      </div>
      
      <div class="question-card" style="margin-top: 30px; background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); border-left: 5px solid #ff9800;">
        <h3 style="color: #e65100; margin-bottom: 20px;">📝 데이터 분석 문제</h3>
        
        <div style="margin-bottom: 25px;">
          <div class="question-title">문제 1: 꺾은선 그래프를 보고 예상해보세요</div>
          <p style="margin: 15px 0; font-size: 1.1em;">
            2025년도에는 2024년도보다 민원이 어떨지 될까요? 그렇게 생각한 이유도 쓰세요.
          </p>
          <div style="margin-top: 20px;">
            <p style="font-weight: 600; margin-bottom: 15px; color: var(--winter-blue-700);">민원이 어떻게 될까요?</p>
            <ul class="question-options" style="margin-top: 15px;">
              <li class="question-option stage1-q1" data-answer="늘어난다" data-correct="false">늘어난다</li>
              <li class="question-option stage1-q1" data-answer="줄어든다" data-correct="true">줄어든다</li>
            </ul>
          </div>
          <div style="margin-top: 25px;">
            <p style="font-weight: 600; margin-bottom: 15px; color: var(--winter-blue-700);">그렇게 생각한 이유를 쓰세요:</p>
            <textarea id="prediction-reason" class="input-field" 
                      placeholder="예: 그래프를 보면 최근 몇 년간 민원이 계속 증가하는 경향이 있어서..."
                      style="min-height: 100px;">${appState.answers.predictionReason || ''}</textarea>
          </div>
          <div id="q1-feedback" style="margin-top: 15px; font-weight: 600;"></div>
        </div>
        
        <div style="margin-bottom: 25px;">
          <div class="question-title">문제 2: 막대그래프를 보고 답하세요</div>
          <p style="margin: 15px 0; font-size: 1.1em;">
            2024년에서 가장 많은 민원이 나온 달은 언제인가요?
          </p>
          <ul class="question-options" style="margin-top: 15px;">
            <li class="question-option stage1-q2" data-answer="10월" data-correct="false">10월</li>
            <li class="question-option stage1-q2" data-answer="11월" data-correct="true">11월</li>
            <li class="question-option stage1-q2" data-answer="12월" data-correct="false">12월</li>
          </ul>
          <div id="q2-feedback" style="margin-top: 15px; font-weight: 600;"></div>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        ${appState.currentStage > 0 ? '<button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>' : ''}
        <button class="btn" id="next-stage-btn" disabled>다음 단계로</button>
      </div>
    </div>
  `
}

// 2단계: 문제의 원인 예상하기
function renderStage2() {
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">📐 2단계: 문제의 원인 예상하기</h1>
        <p class="stage-subtitle">데이터를 보고 문제의 원인을 예상해봅시다</p>
      </div>
      
      <div class="question-card">
        <div class="question-title">문제 3: 데이터 분석 + 예상하기</div>
        <p style="margin: 15px 0; font-size: 1.1em;">
          우리 학교 주변에 불법 주정차 문제가 일어나는 원인은 무엇이라고 생각하나요?
        </p>
        <textarea id="problem-cause" class="input-field" 
                  placeholder="예: 주차 공간이 부족해서, 주민들이 자기의 편리함만을 생각해서 등..."
                  value="${appState.answers.problemCause || ''}">${appState.answers.problemCause || ''}</textarea>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>
        <button class="btn" id="next-stage-btn" disabled>다음 단계로</button>
      </div>
    </div>
  `
}

// 3단계: 교과서와 내 예상 비교하기
function renderStage3() {
  const expectedAnswers = [
    '주차 공간이 부족해서',
    '주민들이 자기의 편리함만을 생각해서',
    '주차 공간을 효율적으로 사용하려는 노력이 부족해서',
    '불법 주차 단속이 꾸준히 이루어지지 않고 벌금이 적어서',
    '불법 주차 때문에 생기는 피해가 얼마나 심각한지 잘 모르는 주민이 많아서'
  ]
  
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">🤔 3단계: 교과서와 내 예상 비교하기</h1>
        <p class="stage-subtitle">교과서 내용과 내가 예상한 원인을 비교해봅시다</p>
      </div>
      
      <div class="question-card">
        <div class="question-title">교과서에서 제시한 주요 원인들:</div>
        <ul style="list-style: none; padding: 0; margin: 20px 0;">
          ${expectedAnswers.map((answer, index) => `
            <li style="padding: 12px; margin: 8px 0; background: white; border-left: 4px solid var(--winter-blue-500); 
                       border-radius: 8px; font-size: 1.05em;">
              ${index + 1}. ${answer}
            </li>
          `).join('')}
        </ul>
      </div>
      
      <div class="question-card">
        <p style="font-size: 1.1em; color: var(--winter-blue-700);">
          여러분이 생각한 원인과 교과서의 원인을 비교해보고,<br>
          가장 중요한 원인이라고 생각하는 것을 선택해주세요.
        </p>
        <select id="main-cause" class="input-field" style="margin-top: 15px;" value="${appState.answers.mainCause || ''}">
          <option value="">가장 중요한 원인을 선택하세요</option>
          ${expectedAnswers.map(answer => `
            <option value="${answer}" ${appState.answers.mainCause === answer ? 'selected' : ''}>${answer}</option>
          `).join('')}
        </select>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>
        <button class="btn" id="next-stage-btn" disabled>다음 단계로</button>
      </div>
    </div>
  `
}

// 4단계: 공약 쓰기
function renderStage4() {
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">✍️ 4단계: 공약 쓰기!</h1>
        <p class="stage-subtitle">해결방안을 제시하고 공약을 작성해봅시다</p>
      </div>
      
      <div class="question-card" style="margin-bottom: 30px;">
        <p style="font-size: 1.1em; color: var(--winter-blue-700); line-height: 1.8;">
          <strong>가정통신문:</strong> 등교시간 학교 앞 불법 주정차 문제가 심각합니다. 
          학생들의 안전을 위해 학부모님들의 협조를 부탁드립니다.
        </p>
        <p style="margin-top: 20px; font-style: italic; color: var(--winter-blue-600);">
          여기서 알 수 있는 사실: 학교 주변에서도 불법 주정차가 지속적으로 발생하고 있습니다.
        </p>
      </div>
      
      <div class="question-card">
        <div class="input-group">
          <label class="input-label">문제 상황은 무엇인가요? (한 문장)</label>
          <input type="text" id="proposal-problem" class="input-field" 
                 placeholder="예: 학교 앞 학부모들이 불법 주정차하면서 민원이 발생하고 있습니다"
                 value="${appState.proposal.problem}">
        </div>
        
        <div class="input-group">
          <label class="input-label">어떤 해결방안을 제안하나요? (한 문장)</label>
          <input type="text" id="proposal-solution" class="input-field" 
                 placeholder="예: 공공 기관의 주차장을 주민들에게 개방하기"
                 value="${appState.proposal.solution}">
        </div>
        
        <div class="input-group">
          <label class="input-label">왜 그렇게 생각하나요? (두세 문장)</label>
          <textarea id="proposal-reason" class="input-field" 
                    placeholder="예: 주차 공간이 부족한 시간대는 주로 오후 6시 이후입니다. 오후 6시 이후에 공공 기관의 주차장을 개방하면 주차 문제를 해결할 수 있을 것입니다."
                    style="min-height: 120px;">${appState.proposal.reason}</textarea>
        </div>
      </div>
      
      <button class="btn" id="combine-btn" disabled>문장 연결하기</button>
      
      <div id="combined-proposal" class="${appState.proposal.combinedText ? '' : 'hidden'}" style="margin-top: 30px;">
        <div class="speech-container">
          <h3 style="color: var(--winter-blue-700); margin-bottom: 15px;">연결된 공약문:</h3>
          <div id="combined-text" style="font-size: 1.1em; line-height: 1.8; color: var(--winter-blue-900);">${appState.proposal.combinedText || ''}</div>
        </div>
        
        ${appState.proposal.combinedText ? `
          <button class="btn" id="get-feedback-btn" style="margin-top: 20px;">AI 피드백 받기</button>
          ${appState.aiFeedback ? `
            <div id="ai-feedback-container" class="question-card" style="margin-top: 20px;">
              <div class="ai-feedback">
                <h3>🤖 AI 선생님의 피드백</h3>
                <div class="ai-feedback-content">${appState.aiFeedback.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            <button class="btn hidden" id="next-stage-btn" style="margin-top: 20px;">다음 단계로</button>
          ` : ''}
        ` : ''}
      </div>
      
      <div id="ai-feedback-container" class="hidden"></div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>
        <button class="btn hidden" id="next-stage-btn">다음 단계로 (투표하기)</button>
      </div>
    </div>
  `
}

// Firebase에서 제안 불러오기
async function loadProposalsFromFirebase() {
  if (!db) {
    // Firebase가 초기화되지 않았으면 localStorage 사용
    const proposals = JSON.parse(localStorage.getItem('allProposals') || '[]')
    appState.allProposals = proposals
    return proposals
  }
  
  try {
    const proposalsRef = ref(db, 'proposals')
    const snapshot = await get(proposalsRef)
    
    if (snapshot.exists()) {
      const proposalsData = snapshot.val()
      const proposals = Object.keys(proposalsData).map(key => ({
        id: key,
        ...proposalsData[key]
      }))
      appState.allProposals = proposals
      return proposals
    }
    return []
  } catch (error) {
    console.error('제안 불러오기 실패:', error)
    // Firebase 실패 시 localStorage 사용
    const proposals = JSON.parse(localStorage.getItem('allProposals') || '[]')
    appState.allProposals = proposals
    return proposals
  }
}

// Firebase에서 투표 불러오기
async function loadVotesFromFirebase() {
  if (!db) {
    // Firebase가 초기화되지 않았으면 localStorage 사용
    const votes = JSON.parse(localStorage.getItem('votes') || '{}')
    appState.votes = votes
    return votes
  }
  
  try {
    const votesRef = ref(db, 'votes/all')
    const snapshot = await get(votesRef)
    
    if (snapshot.exists()) {
      const votesData = snapshot.val()
      appState.votes = votesData || {}
      return votesData || {}
    }
    return {}
  } catch (error) {
    console.error('투표 불러오기 실패:', error)
    const votes = JSON.parse(localStorage.getItem('votes') || '{}')
    appState.votes = votes
    return votes
  }
}

// 투표 상태 확인 (open/closed)
async function getVotingStatus() {
  if (!db) {
    return localStorage.getItem('votingStatus') || 'open'
  }
  
  try {
    const statusRef = ref(db, 'votingStatus')
    const snapshot = await get(statusRef)
    
    if (snapshot.exists()) {
      return snapshot.val()
    }
    return 'open' // 기본값은 열림
  } catch (error) {
    console.error('투표 상태 확인 실패:', error)
    return localStorage.getItem('votingStatus') || 'open'
  }
}

// 투표 종료 설정
async function closeVoting() {
  if (!db) {
    localStorage.setItem('votingStatus', 'closed')
    return
  }
  
  try {
    const statusRef = ref(db, 'votingStatus')
    await set(statusRef, 'closed')
    localStorage.setItem('votingStatus', 'closed')
  } catch (error) {
    console.error('투표 종료 설정 실패:', error)
    localStorage.setItem('votingStatus', 'closed')
  }
}

// 투표 재개 설정
async function openVoting() {
  if (!db) {
    localStorage.setItem('votingStatus', 'open')
    return
  }
  
  try {
    const statusRef = ref(db, 'votingStatus')
    await set(statusRef, 'open')
    localStorage.setItem('votingStatus', 'open')
  } catch (error) {
    console.error('투표 재개 설정 실패:', error)
    localStorage.setItem('votingStatus', 'open')
  }
}

// 삭제된 제안 목록 불러오기
async function loadDeletedProposals() {
  if (!db) {
    const deleted = JSON.parse(localStorage.getItem('deletedProposals') || '[]')
    return deleted
  }
  
  try {
    const deletedRef = ref(db, 'deletedProposals')
    const snapshot = await get(deletedRef)
    
    if (snapshot.exists()) {
      const deletedData = snapshot.val()
      return Array.isArray(deletedData) ? deletedData : Object.values(deletedData)
    }
    return []
  } catch (error) {
    console.error('삭제된 제안 목록 불러오기 실패:', error)
    const deleted = JSON.parse(localStorage.getItem('deletedProposals') || '[]')
    return deleted
  }
}

// 삭제된 제안 저장
async function saveDeletedProposal(studentName) {
  if (!db) {
    const deleted = JSON.parse(localStorage.getItem('deletedProposals') || '[]')
    if (!deleted.includes(studentName)) {
      deleted.push(studentName)
      localStorage.setItem('deletedProposals', JSON.stringify(deleted))
    }
    return
  }
  
  try {
    const deletedRef = ref(db, 'deletedProposals')
    const currentDeleted = await loadDeletedProposals()
    
    if (!currentDeleted.includes(studentName)) {
      const updatedDeleted = [...currentDeleted, studentName]
      await set(deletedRef, updatedDeleted)
      localStorage.setItem('deletedProposals', JSON.stringify(updatedDeleted))
    }
  } catch (error) {
    console.error('삭제된 제안 저장 실패:', error)
    const deleted = JSON.parse(localStorage.getItem('deletedProposals') || '[]')
    if (!deleted.includes(studentName)) {
      deleted.push(studentName)
      localStorage.setItem('deletedProposals', JSON.stringify(deleted))
    }
  }
}

// 5단계: 동료 평가/투표
async function renderStage5() {
  // Firebase에서 모든 제안 불러오기
  const proposals = await loadProposalsFromFirebase()
  
  // 투표 상태 확인
  const votingStatus = await getVotingStatus()
  const isVotingClosed = votingStatus === 'closed'
  
  if (proposals.length === 0) {
    return `
      <div class="stage-container">
        <div class="stage-header">
          <h1 class="stage-title">🗳️ 5단계: 동료 평가/투표</h1>
        </div>
        <p style="text-align: center; font-size: 1.2em; padding: 40px;">
          다른 친구들의 제안이 아직 없습니다. 잠시만 기다려주세요.
    </p>
  </div>
    `
  }
  
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">🗳️ 5단계: 동료 평가/투표</h1>
        <p class="stage-subtitle">친구들의 해결방안을 평가해주세요</p>
      </div>
      
      ${isVotingClosed ? `
        <div class="question-card" style="background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); border-left: 5px solid #f44336; margin-bottom: 30px;">
          <h3 style="color: #c62828; margin-bottom: 10px;">⏰ 투표가 종료되었습니다</h3>
          <p style="color: #b71c1c; line-height: 1.8;">
            교사님이 투표를 종료하셨습니다. 더 이상 투표할 수 없으며, 현재 결과가 최종 결과로 확정되었습니다.
          </p>
          <p style="color: #d32f2f; line-height: 1.8; margin-top: 10px; font-size: 0.9em; font-style: italic;">
            💡 교사님이 투표를 재개하면 다시 투표할 수 있습니다.
          </p>
        </div>
      ` : `
        <div class="question-card" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-left: 5px solid #4caf50; margin-bottom: 30px;">
          <h3 style="color: #2e7d32; margin-bottom: 10px;">🟢 투표 진행 중</h3>
          <p style="color: #1b5e20; line-height: 1.8;">
            현재 투표가 진행 중입니다. 친구들의 해결방안을 평가해주세요!
          </p>
        </div>
      `}
      
      <div id="voting-section">
        ${proposals.map((proposal, index) => `
          <div class="question-card" style="margin-bottom: 30px;">
            <h3 style="color: var(--winter-blue-700); margin-bottom: 15px;">
              제안 ${index + 1}: ${proposal.name}님의 해결방안
            </h3>
            <div style="background: var(--winter-ice); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <p style="line-height: 1.8; font-size: 1.05em;">${proposal.combinedText || proposal.text}</p>
            </div>
            
            <table class="evaluation-table">
              <thead>
                <tr>
                  <th>평가 기준</th>
                  <th>효과가 큰가요?</th>
                  <th>비용이 적게 드나요?</th>
                  <th>실천할 수 있나요?</th>
                  <th>누군가에게 피해를 주지 않나요?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${proposal.name}</strong></td>
                  <td>
                    ${[1, 2, 3, 4, 5].map(score => `
                      <button class="rating-btn" data-proposal="${index}" 
                              data-criteria="effect" data-score="${score}" 
                              ${isVotingClosed ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>${score}</button>
                    `).join('')}
                  </td>
                  <td>
                    ${[1, 2, 3, 4, 5].map(score => `
                      <button class="rating-btn" data-proposal="${index}" 
                              data-criteria="cost" data-score="${score}" 
                              ${isVotingClosed ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>${score}</button>
                    `).join('')}
                  </td>
                  <td>
                    ${[1, 2, 3, 4, 5].map(score => `
                      <button class="rating-btn" data-proposal="${index}" 
                              data-criteria="practical" data-score="${score}" 
                              ${isVotingClosed ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>${score}</button>
                    `).join('')}
                  </td>
                  <td>
                    ${[1, 2, 3, 4, 5].map(score => `
                      <button class="rating-btn" data-proposal="${index}" 
                              data-criteria="harmless" data-score="${score}" 
                              ${isVotingClosed ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>${score}</button>
                    `).join('')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>
        <button class="btn" id="submit-votes-btn" ${isVotingClosed ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : 'disabled'}>투표 완료하기</button>
      </div>
      
      ${isVotingClosed ? `
        <div style="text-align: center; margin-top: 30px; color: #f44336; font-size: 0.9em; font-weight: 600;">
          ⏰ 투표가 종료되어 더 이상 투표할 수 없습니다.
        </div>
      ` : `
        <div style="text-align: center; margin-top: 30px; color: var(--winter-blue-600); font-size: 0.9em;">
          💡 다른 학생들이 제안을 추가하면 자동으로 업데이트됩니다!
        </div>
      `}
    </div>
  `
  
  // 실시간 업데이트 설정
  setTimeout(() => {
    setupRealtimeUpdates()
  }, 100)
}

// 실시간 업데이트 설정
function setupRealtimeUpdates() {
  if (!db) return; // Firebase가 초기화되지 않았으면 실시간 업데이트 비활성화
  
  // 제안 실시간 업데이트
  const proposalsRef = ref(db, 'proposals')
  
  onValue(proposalsRef, (snapshot) => {
    if (snapshot.exists()) {
      const proposalsData = snapshot.val()
      const proposals = Object.keys(proposalsData).map(key => ({
        id: key,
        ...proposalsData[key]
      }))
      
      // 제안이 변경되었고 현재 5단계에 있으면 화면 업데이트
      if (appState.currentStage === 5) {
        appState.allProposals = proposals
        renderApp()
        attachEventListeners()
      } else {
        appState.allProposals = proposals
      }
    }
  }, (error) => {
    console.error('제안 실시간 업데이트 오류:', error)
  })
  
  // 투표 상태 실시간 업데이트
  const votingStatusRef = ref(db, 'votingStatus')
  
  onValue(votingStatusRef, async (snapshot) => {
    const votingStatus = snapshot.exists() ? snapshot.val() : 'open'
    localStorage.setItem('votingStatus', votingStatus)
    
    // 5단계 또는 6단계에 있으면 화면 업데이트
    if (appState.currentStage === 5 || appState.currentStage === 6) {
      await renderApp()
      attachEventListeners()
      
      // 투표가 종료되었고 6단계에 있으면 연설문 생성
      if (votingStatus === 'closed' && appState.currentStage === 6) {
        setTimeout(() => {
          generateSpeech()
        }, 500)
      }
    }
  }, (error) => {
    console.error('투표 상태 실시간 업데이트 오류:', error)
  })
}

// 6단계: 1등 해결방안 연설문
async function renderStage6() {
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : await loadProposalsFromFirebase()
  
  // Firebase에서 투표 결과 가져오기
  const voteResults = await loadVotesFromFirebase()
  
  // 투표 종료 상태 확인
  const votingStatus = await getVotingStatus()
  const isVotingClosed = votingStatus === 'closed'
  
  // 각 제안의 총점 계산
  // 투표 데이터 구조: { [studentName]: { [proposalIndex]: { effect, cost, practical, harmless } } }
  const proposalScores = proposals.map((proposal, index) => {
    let totalEffect = 0
    let totalCost = 0
    let totalPractical = 0
    let totalHarmless = 0
    let voteCount = 0
    
    // 모든 학생의 투표를 합산
    Object.keys(voteResults).forEach(studentName => {
      const studentVote = voteResults[studentName]
      if (studentVote && studentVote[index]) {
        const vote = studentVote[index]
        totalEffect += vote.effect || 0
        totalCost += vote.cost || 0
        totalPractical += vote.practical || 0
        totalHarmless += vote.harmless || 0
        voteCount++
      }
    })
    
    const total = totalEffect + totalCost + totalPractical + totalHarmless
    return { 
      index, 
      proposal, 
      total, 
      effect: totalEffect, 
      cost: totalCost, 
      practical: totalPractical, 
      harmless: totalHarmless,
      voteCount
    }
  })
  
  // 1등 찾기
  proposalScores.sort((a, b) => b.total - a.total)
  const winner = proposalScores[0]
  
  if (!winner || !winner.proposal) {
    return `
      <div class="stage-container">
        <div class="stage-header">
          <h1 class="stage-title">🏆 6단계: 1등 해결방안 연설문</h1>
        </div>
        <p style="text-align: center; padding: 40px; font-size: 1.2em;">
          1등 해결방안을 찾을 수 없습니다. 제안과 투표가 제대로 완료되었는지 확인해주세요.
        </p>
      </div>
    `
  }
  
  // 투표가 진행 중일 때는 1등을 표시하지 않음
  if (!isVotingClosed) {
    return `
      <div class="stage-container">
        <div class="stage-header">
          <h1 class="stage-title">🏆 6단계: 1등 해결방안 연설문</h1>
          <p class="stage-subtitle">최종 결과는 투표 종료 후 확인할 수 있습니다</p>
        </div>
        
        <div class="question-card" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-left: 5px solid var(--winter-blue-500); margin-bottom: 30px; text-align: center; padding: 40px;">
          <div style="font-size: 4em; margin-bottom: 20px;">⏳</div>
          <h3 style="color: var(--winter-blue-700); margin-bottom: 15px; font-size: 1.5em;">투표 진행 중</h3>
          <p style="color: var(--winter-blue-900); line-height: 2; font-size: 1.1em; margin-bottom: 10px;">
            아직 투표가 진행 중입니다.<br>
            모든 학생들이 투표를 완료하면,<br>
            교사님이 투표를 종료하고 최종 결과를 확정합니다.
          </p>
          <p style="color: var(--winter-blue-700); font-size: 1em; margin-top: 20px; font-weight: 600;">
            📊 현재까지 ${Object.keys(voteResults).length}명이 투표했습니다
          </p>
          <p style="color: var(--winter-blue-600); font-size: 0.9em; margin-top: 10px;">
            투표 종료 후 1등 해결방안을 확인할 수 있습니다!
          </p>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>
          <button class="btn" id="exit-btn">나가기</button>
        </div>
      </div>
    `
  }
  
  // 투표가 종료되었을 때만 1등 결과 표시
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">🏆 6단계: 1등 해결방안 연설문</h1>
        <p class="stage-subtitle">가장 높은 점수를 받은 해결방안입니다!</p>
      </div>
      
      <div class="question-card" style="background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); border-left: 5px solid #ff9800; margin-bottom: 30px;">
        <h3 style="color: #e65100; margin-bottom: 10px;">✅ 최종 확정 결과</h3>
        <p style="color: #bf360c; line-height: 1.8;">
          교사님이 투표를 종료하여 현재 결과가 최종 결과로 확정되었습니다.
        </p>
      </div>
      
      <div class="speech-container">
        <div class="speech-title">🎉 1등: ${winner.proposal.name}님의 해결방안</div>
        <div style="text-align: center; margin: 30px 0; font-size: 1.3em; color: var(--winter-blue-600);">
          총점: ${winner.total}점 (${winner.voteCount}명 평가)
        </div>
        <div class="speech-content" id="speech-content">
          <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 20px;">연설문을 작성하고 있습니다...</p>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>
        <button class="btn hidden" id="next-stage-btn">다음 단계로 (대시보드 보기)</button>
      </div>
    </div>
  `
  
  // 실시간 업데이트 설정
  setTimeout(() => {
    setupRealtimeUpdates()
  }, 100)
}

// 7단계: 개인 대시보드
async function renderStage7() {
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : await loadProposalsFromFirebase()
  
  const votes = await loadVotesFromFirebase()
  
  const myProposalIndex = proposals.findIndex(p => p.name === appState.studentName)
  const myProposal = myProposalIndex >= 0 ? proposals[myProposalIndex] : null
  
  if (!myProposal) {
    return `
      <div class="stage-container">
        <div class="stage-header">
          <h1 class="stage-title">📊 7단계: 개인 대시보드</h1>
        </div>
        <p style="text-align: center; padding: 40px;">제안 정보를 찾을 수 없습니다.</p>
      </div>
    `
  }
  
  // 모든 학생의 투표를 합산하여 내 제안의 점수 계산
  // 투표 데이터 구조: { [studentName]: { [proposalIndex]: { effect, cost, practical, harmless } } }
  let totalEffect = 0
  let totalCost = 0
  let totalPractical = 0
  let totalHarmless = 0
  let voteCount = 0
  
  Object.keys(votes).forEach(studentName => {
    const studentVote = votes[studentName]
    if (studentVote && studentVote[myProposalIndex]) {
      const vote = studentVote[myProposalIndex]
      totalEffect += vote.effect || 0
      totalCost += vote.cost || 0
      totalPractical += vote.practical || 0
      totalHarmless += vote.harmless || 0
      voteCount++
    }
  })
  
  // 평균 점수 계산
  const avgEffect = voteCount > 0 ? (totalEffect / voteCount).toFixed(1) : 0
  const avgCost = voteCount > 0 ? (totalCost / voteCount).toFixed(1) : 0
  const avgPractical = voteCount > 0 ? (totalPractical / voteCount).toFixed(1) : 0
  const avgHarmless = voteCount > 0 ? (totalHarmless / voteCount).toFixed(1) : 0
  
  const effect = totalEffect
  const cost = totalCost
  const practical = totalPractical
  const harmless = totalHarmless
  const total = effect + cost + practical + harmless
  
  const scores = [
    { label: '효과가 큰가요?', value: effect, avg: parseFloat(avgEffect), max: 5, key: 'effect', badge: '문제 해결력 배지', badgeIcon: '🎯' },
    { label: '비용이 적게 드나요?', value: cost, avg: parseFloat(avgCost), max: 5, key: 'cost', badge: '알뜰 아이디어 배지', badgeIcon: '💰' },
    { label: '실천할 수 있나요?', value: practical, avg: parseFloat(avgPractical), max: 5, key: 'practical', badge: '바로 실천 배지', badgeIcon: '⚡' },
    { label: '피해를 주지 않나요?', value: harmless, avg: parseFloat(avgHarmless), max: 5, key: 'harmless', badge: '모두에게 좋아요 배지', badgeIcon: '❤️' }
  ]
  
  // 가장 강점인 부분 찾기 (평균 점수 기준)
  const maxAvgScore = Math.max(...scores.map(s => s.avg))
  const strengths = scores.filter(s => s.avg === maxAvgScore && s.avg > 0).map(s => ({ label: s.label, badge: s.badge, badgeIcon: s.badgeIcon }))
  const strengthKeys = scores.filter(s => s.avg === maxAvgScore && s.avg > 0).map(s => s.key)
  
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">📊 7단계: ${appState.studentName}님의 대시보드</h1>
        <p class="stage-subtitle">당신의 해결방안 평가 결과입니다</p>
      </div>
      
      <div class="speech-container" style="margin-bottom: 30px;">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 15px;">당신의 해결방안:</h3>
        <p style="line-height: 1.8; font-size: 1.05em;">${myProposal.combinedText || myProposal.text}</p>
      </div>
      
      <div class="dashboard">
        ${scores.map((score, index) => {
          const isStrength = strengthKeys.includes(score.key)
          return `
          <div class="dashboard-card ${isStrength ? 'strength-badge' : ''}" style="position: relative; ${isStrength ? 'border: 3px solid #ff9800; box-shadow: 0 6px 20px rgba(255, 152, 0, 0.3);' : ''}">
            ${isStrength ? `
              <div class="strength-badge-icon" style="position: absolute; top: -15px; right: -15px; background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(255, 215, 0, 0.5); z-index: 10; border: 3px solid white; animation: pulse 2s infinite;">
                <span style="font-size: 28px;">${score.badgeIcon}</span>
              </div>
            ` : ''}
            <h3 style="margin-bottom: 15px; font-size: 1.2em; ${isStrength ? 'color: #ff9800; font-weight: 700;' : ''}">${score.label}</h3>
            <div class="dashboard-score" style="font-size: 2.5em; ${isStrength ? 'color: #ff9800; font-weight: 700;' : 'color: var(--winter-blue-700);'}">${score.avg}</div>
            <div class="dashboard-label" style="font-size: 1.1em; margin-top: 5px; ${isStrength ? 'color: #e65100; font-weight: 600;' : ''}">평균 ${score.avg}점 / ${score.max}점 만점</div>
            <div style="margin-top: 10px; font-size: 0.9em; color: var(--winter-blue-600); font-weight: 500;">
              ${voteCount}명이 평가함
            </div>
            ${isStrength ? `
              <div style="margin-top: 15px; padding: 10px; background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); border-radius: 8px; border: 2px solid #ff9800;">
                <div style="font-size: 1.1em; font-weight: 700; color: #e65100; text-align: center;">
                  ${score.badgeIcon} ${score.badge}
                </div>
              </div>
            ` : ''}
          </div>
        `}).join('')}
        
        <div class="dashboard-card" style="background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%);">
          <h3>총점</h3>
          <div class="dashboard-score" style="color: #ff9800;">${total}</div>
          <div class="dashboard-label">/ ${voteCount * 20}점 (${voteCount}명 평가)</div>
          <div style="margin-top: 8px; font-size: 0.85em; color: #e65100;">
            평균 총점: ${voteCount > 0 ? (total / voteCount).toFixed(1) : 0}점 / 20점
          </div>
        </div>
      </div>
      
      ${strengths.length > 0 ? `
        <div class="question-card" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
                                         border-left: 5px solid #4caf50; margin-top: 30px; padding: 25px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
            <span style="font-size: 2.5em;">⭐</span>
            <h3 style="color: #2e7d32; margin: 0; font-size: 1.5em;">가장 강점인 부분</h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 20px;">
            ${strengths.map(strength => `
              <div style="padding: 20px; font-size: 1.2em; color: #1b5e20; background: white; border-radius: 12px; border-left: 5px solid #4caf50; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2); text-align: center;">
                <div style="font-size: 2em; margin-bottom: 10px;">${strength.badgeIcon}</div>
                <div style="font-weight: 700; margin-bottom: 5px;">${strength.badge}</div>
                <div style="font-size: 0.9em; color: #2e7d32;">${strength.label}</div>
              </div>
            `).join('')}
          </div>
          <p style="margin-top: 20px; color: #2e7d32; font-size: 1em; font-weight: 600; text-align: center; padding: 15px; background: rgba(255, 255, 255, 0.7); border-radius: 8px;">
            🎉 이 항목에서 가장 높은 평균 점수(${maxAvgScore}점)를 받았습니다!
          </p>
        </div>
      ` : ''}
      
      <div style="display: flex; gap: 10px; margin-top: 30px;">
        <button class="btn btn-secondary" id="prev-stage-btn">이전 단계로</button>
        <button class="btn" id="exit-btn">나가기</button>
      </div>
    </div>
  `
}

// 8단계: 관리자 페이지
async function renderAdminStage() {
  const proposals = await loadProposalsFromFirebase()
  const votes = await loadVotesFromFirebase()
  const votingStatus = await getVotingStatus()
  
  // 모든 학생의 제안 요약
  const proposalsSummary = proposals.map((proposal, index) => {
    // 각 제안에 대한 투표 통계 계산
    let totalEffect = 0, totalCost = 0, totalPractical = 0, totalHarmless = 0
    let voteCount = 0
    
    Object.keys(votes).forEach(studentName => {
      const studentVote = votes[studentName]
      if (studentVote && studentVote[index]) {
        const vote = studentVote[index]
        totalEffect += vote.effect || 0
        totalCost += vote.cost || 0
        totalPractical += vote.practical || 0
        totalHarmless += vote.harmless || 0
        voteCount++
      }
    })
    
    const avgEffect = voteCount > 0 ? (totalEffect / voteCount).toFixed(1) : 0
    const avgCost = voteCount > 0 ? (totalCost / voteCount).toFixed(1) : 0
    const avgPractical = voteCount > 0 ? (totalPractical / voteCount).toFixed(1) : 0
    const avgHarmless = voteCount > 0 ? (totalHarmless / voteCount).toFixed(1) : 0
    const total = totalEffect + totalCost + totalPractical + totalHarmless
    const avgTotal = voteCount > 0 ? (total / voteCount).toFixed(1) : 0
    
    return {
      id: proposal.id,
      name: proposal.name,
      proposal: proposal.combinedText || proposal.text,
      problem: proposal.problem,
      solution: proposal.solution,
      reason: proposal.reason,
      // 2단계 데이터
      problemCause: proposal.problemCause || '',
      mainCause: proposal.mainCause || '',
      voteCount,
      avgEffect,
      avgCost,
      avgPractical,
      avgHarmless,
      avgTotal,
      total
    }
  })
  
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">👨‍🏫 관리자 페이지</h1>
        <p class="stage-subtitle">학생 데이터 관리 및 조회</p>
      </div>
      
      <div style="display: flex; gap: 15px; margin-bottom: 30px; flex-wrap: wrap;">
        <button class="btn" id="refresh-data-btn" style="background: linear-gradient(135deg, var(--winter-blue-500) 0%, var(--winter-blue-600) 100%); color: white;">
          🔄 데이터 새로고침
        </button>
        ${votingStatus === 'open' ? `
          <button class="btn" id="close-voting-btn" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white;">
            ⏰ 투표 종료 및 결과 확정
          </button>
        ` : `
          <button class="btn" id="open-voting-btn" style="background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white;">
            🔓 투표 재개
          </button>
        `}
        <button class="btn" id="clear-data-btn" style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white;">
          🗑️ 모든 데이터 초기화
        </button>
        <button class="btn btn-secondary" id="back-to-main-btn">
          ← 메인으로 돌아가기
        </button>
      </div>
      
      ${votingStatus === 'closed' ? `
        <div class="question-card" style="background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); border-left: 5px solid #ff9800; margin-bottom: 30px;">
          <h3 style="color: #e65100; margin-bottom: 10px;">✅ 투표가 종료되었습니다</h3>
          <p style="color: #bf360c; line-height: 1.8;">
            현재 결과가 최종 결과로 확정되었습니다. 학생들은 더 이상 투표할 수 없으며, 6단계에서 확정된 1등 결과를 볼 수 있습니다.
          </p>
          <p style="color: #e65100; line-height: 1.8; margin-top: 10px; font-size: 0.9em; font-style: italic;">
            💡 "투표 재개" 버튼을 누르면 학생들이 다시 투표할 수 있습니다. (데모 목적으로 사용 가능)
          </p>
        </div>
      ` : `
        <div class="question-card" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-left: 5px solid #4caf50; margin-bottom: 30px;">
          <h3 style="color: #2e7d32; margin-bottom: 10px;">🟢 투표 진행 중</h3>
          <p style="color: #1b5e20; line-height: 1.8;">
            학생들이 투표를 진행하고 있습니다. 투표를 종료하려면 "투표 종료 및 결과 확정" 버튼을 클릭하세요.
          </p>
        </div>
      `}
      
      <div class="question-card" style="margin-bottom: 30px;">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 20px;">📊 전체 통계</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div style="background: var(--winter-blue-50); padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 2em; font-weight: 700; color: var(--winter-blue-700);">${proposals.length}</div>
            <div style="color: var(--winter-blue-600);">제안 수</div>
          </div>
          <div style="background: var(--winter-blue-50); padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 2em; font-weight: 700; color: var(--winter-blue-700);">${Object.keys(votes).length}</div>
            <div style="color: var(--winter-blue-600);">투표한 학생 수</div>
          </div>
        </div>
      </div>
      
      <div class="question-card">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 20px;">📝 학생 제안 및 평가 결과</h3>
        ${proposalsSummary.length === 0 ? `
          <p style="text-align: center; padding: 40px; color: var(--winter-blue-600);">
            아직 제안이 없습니다.
          </p>
        ` : proposalsSummary.map((item, index) => `
          <div style="background: var(--winter-ice); padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 5px solid var(--winter-blue-500); position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h4 style="color: var(--winter-blue-700); margin: 0;">
                ${index + 1}. ${item.name}님의 제안
              </h4>
              <button class="btn" id="delete-proposal-btn-${item.id}" 
                      style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 8px 16px; font-size: 0.9em; border: none; border-radius: 6px; cursor: pointer;"
                      data-proposal-id="${item.id}" 
                      data-proposal-name="${item.name}">
                🗑️ 삭제
              </button>
            </div>
            
            ${item.problemCause ? `
              <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--winter-blue-500);">
                <h5 style="color: var(--winter-blue-700); margin-bottom: 10px; font-size: 1.1em;">📐 2단계: 문제 원인 분석</h5>
                <p style="color: var(--winter-blue-900); line-height: 1.8; margin-bottom: 10px;">
                  <strong>학생이 생각한 원인:</strong> ${item.problemCause}
                </p>
                ${item.mainCause ? `
                  <p style="color: var(--winter-blue-900); line-height: 1.8;">
                    <strong>선택한 주요 원인:</strong> ${item.mainCause}
                  </p>
                ` : ''}
              </div>
            ` : ''}
            
            <div style="background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ff9800;">
              <h5 style="color: #e65100; margin-bottom: 10px; font-size: 1.1em;">✍️ 4단계: 해결방안</h5>
              <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                <p style="color: var(--winter-blue-900); line-height: 1.8; margin-bottom: 8px;">
                  <strong>문제 상황:</strong> ${item.problem}
                </p>
                <p style="color: var(--winter-blue-900); line-height: 1.8; margin-bottom: 8px;">
                  <strong>해결방안:</strong> ${item.solution}
                </p>
                <p style="color: var(--winter-blue-900); line-height: 1.8;">
                  <strong>이유:</strong> ${item.reason}
                </p>
              </div>
              <div style="background: white; padding: 12px; border-radius: 6px;">
                <p style="color: var(--winter-blue-900); line-height: 1.8; font-weight: 600;">
                  <strong>최종 공약문:</strong> ${item.proposal}
                </p>
              </div>
            </div>
            ${item.voteCount > 0 ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 15px;">
                <div style="background: white; padding: 10px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 0.85em; color: var(--winter-blue-600);">효과</div>
                  <div style="font-size: 1.5em; font-weight: 700; color: var(--winter-blue-700);">${item.avgEffect}</div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 0.85em; color: var(--winter-blue-600);">비용</div>
                  <div style="font-size: 1.5em; font-weight: 700; color: var(--winter-blue-700);">${item.avgCost}</div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 0.85em; color: var(--winter-blue-600);">실천</div>
                  <div style="font-size: 1.5em; font-weight: 700; color: var(--winter-blue-700);">${item.avgPractical}</div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 0.85em; color: var(--winter-blue-600);">피해 없음</div>
                  <div style="font-size: 1.5em; font-weight: 700; color: var(--winter-blue-700);">${item.avgHarmless}</div>
                </div>
                <div style="background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); padding: 10px; border-radius: 8px; text-align: center; border: 2px solid #ff9800;">
                  <div style="font-size: 0.85em; color: #e65100;">평균 총점</div>
                  <div style="font-size: 1.5em; font-weight: 700; color: #ff9800;">${item.avgTotal}</div>
                  <div style="font-size: 0.75em; color: #e65100;">(${item.voteCount}명 평가)</div>
                </div>
              </div>
            ` : `
              <div style="text-align: center; padding: 15px; color: var(--winter-blue-600);">
                아직 평가가 없습니다.
              </div>
            `}
          </div>
        `).join('')}
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 30px;">
        <button class="btn btn-secondary" id="back-to-main-btn-2">
          ← 메인으로 돌아가기
        </button>
      </div>
    </div>
  `
}

// 개별 제안 삭제 함수
async function deleteProposal(proposalId, studentName) {
  if (!confirm(`⚠️ ${studentName}님의 제안을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!`)) {
    return
  }
  
  if (!db) {
    // Firebase가 없으면 localStorage에서 삭제
    const allProposals = JSON.parse(localStorage.getItem('allProposals') || '[]')
    const filteredProposals = allProposals.filter(p => p.id !== proposalId)
    localStorage.setItem('allProposals', JSON.stringify(filteredProposals))
    appState.allProposals = filteredProposals
    
    // 삭제된 제안 목록에 추가 (학생이 다시 4단계부터 시작할 수 있도록)
    await saveDeletedProposal(studentName)
    
    alert(`✅ ${studentName}님의 제안이 삭제되었습니다!\n\n${studentName}님이 다시 이름을 입력하면 4단계(제안 쓰기)부터 시작할 수 있습니다.`)
    
    // 관리자 페이지 새로고침
    appState.currentStage = 8
    await renderApp()
    return
  }
  
  try {
    // Firebase에서 제안 삭제
    const proposalRef = ref(db, `proposals/${proposalId}`)
    await set(proposalRef, null)
    
    // 로컬 상태도 업데이트
    const updatedProposals = await loadProposalsFromFirebase()
    appState.allProposals = updatedProposals
    
    // localStorage도 업데이트
    const allProposals = JSON.parse(localStorage.getItem('allProposals') || '[]')
    const filteredProposals = allProposals.filter(p => p.id !== proposalId)
    localStorage.setItem('allProposals', JSON.stringify(filteredProposals))
    
    // 삭제된 제안 목록에 추가 (학생이 다시 4단계부터 시작할 수 있도록)
    await saveDeletedProposal(studentName)
    
    alert(`✅ ${studentName}님의 제안이 삭제되었습니다!\n\n${studentName}님이 다시 이름을 입력하면 4단계(제안 쓰기)부터 시작할 수 있습니다.`)
    
    // 관리자 페이지 새로고침
    appState.currentStage = 8
    await renderApp()
  } catch (error) {
    console.error('제안 삭제 실패:', error)
    alert('❌ 제안 삭제 중 오류가 발생했습니다: ' + error.message)
  }
}

// 데이터 초기화 함수
async function clearAllData() {
  if (!confirm('⚠️ 정말로 모든 학생 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!')) {
    return
  }
  
  if (!confirm('⚠️ 한 번 더 확인합니다. 모든 제안과 투표 데이터가 삭제됩니다. 계속하시겠습니까?')) {
    return
  }
  
  if (!db) {
    alert('Firebase가 초기화되지 않았습니다. 데이터를 초기화할 수 없습니다.')
    return
  }
  
  try {
    // proposals와 votes 모두 삭제
    const proposalsRef = ref(db, 'proposals')
    const votesRef = ref(db, 'votes')
    const deletedProposalsRef = ref(db, 'deletedProposals')
    
    await set(proposalsRef, null)
    await set(votesRef, null)
    await set(deletedProposalsRef, null)
    
    // 로컬 상태도 초기화
    appState.allProposals = []
    appState.votes = {}
    localStorage.removeItem('allProposals')
    localStorage.removeItem('votes')
    localStorage.removeItem('deletedProposals')
    
    alert('✅ 모든 데이터가 성공적으로 삭제되었습니다!')
    
    // 관리자 페이지 새로고침
    appState.currentStage = 8
    await renderApp()
  } catch (error) {
    console.error('데이터 초기화 실패:', error)
    alert('❌ 데이터 초기화 중 오류가 발생했습니다: ' + error.message)
  }
}

// 이벤트 리스너 연결
function attachEventListeners() {
  // 0단계: 이름 입력
  const nameInput = document.getElementById('student-name')
  const startBtn = document.getElementById('start-btn')
  
  if (nameInput && startBtn) {
    nameInput.addEventListener('input', (e) => {
      appState.studentName = e.target.value.trim()
      startBtn.disabled = !appState.studentName
      saveProgress() // 이름 입력 시에도 저장
    })
    
    startBtn.addEventListener('click', async () => {
      if (appState.studentName) {
        // 투표 상태 확인
        const votingStatus = await getVotingStatus()
        const isVotingClosed = votingStatus === 'closed'
        
        // 기존 진행 상태 확인
        const proposals = await loadProposalsFromFirebase()
        const votes = await loadVotesFromFirebase()
        const deletedProposals = await loadDeletedProposals()
        const existingProposal = proposals.find(p => p.name === appState.studentName)
        const hasVoted = votes[appState.studentName] && Object.keys(votes[appState.studentName]).length > 0
        const isDeleted = deletedProposals.includes(appState.studentName)
        
        // 투표가 종료된 경우
        if (isVotingClosed) {
          // 새로운 학생 (기존 제안/투표 없음) → 바로 결과 확인
          if (!existingProposal && !hasVoted) {
            // 1등 결과 보기로 이동
            appState.currentStage = 6
            saveProgress()
            await renderApp()
            setTimeout(() => {
              generateSpeech()
            }, 500)
            return
          }
          
          // 기존 학생 → 대시보드 또는 결과 확인
          if (hasVoted) {
            // 투표 완료 → 대시보드
            appState.currentStage = 7
            saveProgress()
            await renderApp()
            return
          } else if (existingProposal) {
            // 제안만 있음 → 1등 결과 보기
            appState.currentStage = 6
            saveProgress()
            await renderApp()
            setTimeout(() => {
              generateSpeech()
            }, 500)
            return
          }
        }
        
        // 투표가 진행 중인 경우
        // 제안이 삭제된 경우 → 4단계부터 시작
        if (isDeleted && !existingProposal && !hasVoted) {
          try {
            console.log('CSV 파일 로드 시작...')
            appState.parkingData = await parseCSV('/illegal_parking.csv')
            console.log('illegal_parking.csv 로드 완료:', appState.parkingData.length, '개')
            appState.cctvData = await parseCSV('/cctv.csv')
            console.log('cctv.csv 로드 완료:', appState.cctvData.length, '개')
            // 4단계로 바로 이동
            appState.currentStage = 4
            saveProgress()
            await renderApp()
            return
          } catch (error) {
            console.error('데이터 로드 실패:', error)
            alert('데이터를 불러오는데 실패했습니다: ' + error.message + '\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요.')
          }
        }
        
        // 기존 진행 상태가 있는 경우
        if (existingProposal || hasVoted) {
          let message = `${appState.studentName}님, 이전에 진행한 내용이 있습니다.\n\n`
          let options = []
          
          if (hasVoted) {
            message += '✅ 투표 완료\n'
            options.push('대시보드 보기 (7단계)')
          } else if (existingProposal) {
            message += '✅ 제안 완료 (투표 미완료)\n'
            options.push('투표하기 (5단계)')
          }
          
          message += '\n어디서부터 시작하시겠습니까?'
          
          const choice = confirm(message + '\n\n확인 = ' + (options[0] || '대시보드') + '\n취소 = 처음부터 시작')
          
          if (choice) {
            // 기존 진행 상태로 이동
            if (hasVoted) {
              // 투표 완료 → 대시보드
              appState.currentStage = 7
              saveProgress()
              await renderApp()
              return
            } else if (existingProposal) {
              // 제안 완료 → 투표
              appState.currentStage = 5
              saveProgress()
              await renderApp()
              return
            }
          }
          // 취소하면 처음부터 시작 (아래 코드 계속 실행)
        }
        
        // 처음부터 시작하거나 기존 진행 상태가 없는 경우
        try {
          console.log('CSV 파일 로드 시작...')
          appState.parkingData = await parseCSV('/illegal_parking.csv')
          console.log('illegal_parking.csv 로드 완료:', appState.parkingData.length, '개')
          appState.cctvData = await parseCSV('/cctv.csv')
          console.log('cctv.csv 로드 완료:', appState.cctvData.length, '개')
          appState.currentStage = 1
          saveProgress()
          renderApp()
          setTimeout(() => {
            renderCharts()
          }, 100)
        } catch (error) {
          console.error('데이터 로드 실패:', error)
          alert('데이터를 불러오는데 실패했습니다: ' + error.message + '\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요.')
        }
      }
    })
    
    // 관리자 페이지 버튼
    const adminBtn = document.getElementById('admin-btn')
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        const password = prompt('관리자 비밀번호를 입력하세요:')
        if (password === 'teacher2024' || password === 'admin') {
          appState.currentStage = 8
          saveProgress()
          renderApp()
        } else if (password !== null) {
          alert('비밀번호가 올바르지 않습니다.')
        }
      })
    }
  }
  
  // 1단계: 가정통신문 드래그 앤 드롭
  const letterAnswerBox = document.getElementById('letter-problem-answer')
  const draggableOptions = document.querySelectorAll('.draggable-option')
  
  if (letterAnswerBox && draggableOptions.length > 0) {
    // 드래그 가능한 옵션들에 이벤트 리스너 추가
    draggableOptions.forEach(option => {
      option.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', this.dataset.option)
        this.style.opacity = '0.5'
      })
      
      option.addEventListener('dragend', function(e) {
        this.style.opacity = '1'
      })
      
      // 클릭으로도 선택 가능
      option.addEventListener('click', function() {
        const selectedOption = this.dataset.option
        appState.answers.letterProblem = selectedOption
        saveProgress() // 진행 상태 저장
        
        letterAnswerBox.textContent = selectedOption
        letterAnswerBox.style.borderColor = 'var(--winter-blue-500)'
        letterAnswerBox.style.backgroundColor = 'var(--winter-blue-50)'
        
        // 피드백 표시
        const feedbackEl = document.getElementById('letter-feedback')
        if (feedbackEl) {
          if (selectedOption === '불법 주정차 문제') {
            feedbackEl.innerHTML = '<span style="color: #4caf50;">✓ 정답입니다! 가정통신문은 불법 주정차 문제에 대한 내용입니다.</span>'
          } else {
            feedbackEl.innerHTML = '<span style="color: #f44336;">✗ 틀렸습니다. 가정통신문을 다시 읽어보세요. 정답은 "불법 주정차 문제"입니다.</span>'
          }
        }
        
        checkStage1Complete()
      })
    })
    
    // 드롭 영역 설정
    letterAnswerBox.addEventListener('dragover', function(e) {
      e.preventDefault()
      this.style.borderColor = 'var(--winter-blue-500)'
      this.style.backgroundColor = 'var(--winter-blue-50)'
    })
    
    letterAnswerBox.addEventListener('dragleave', function(e) {
      e.preventDefault()
      if (!this.textContent || this.textContent === '여기에 드래그하세요') {
        this.style.borderColor = 'var(--winter-blue-300)'
        this.style.backgroundColor = 'white'
      }
    })
    
    letterAnswerBox.addEventListener('drop', function(e) {
      e.preventDefault()
      const selectedOption = e.dataTransfer.getData('text/plain')
      
      appState.answers.letterProblem = selectedOption
      saveProgress() // 진행 상태 저장
      this.textContent = selectedOption
      this.style.borderColor = 'var(--winter-blue-500)'
      this.style.backgroundColor = 'var(--winter-blue-50)'
      
      // 피드백 표시
      const feedbackEl = document.getElementById('letter-feedback')
      if (feedbackEl) {
        if (selectedOption === '불법 주정차 문제') {
          feedbackEl.innerHTML = '<span style="color: #4caf50;">✓ 정답입니다! 가정통신문은 불법 주정차 문제에 대한 내용입니다.</span>'
        } else {
          feedbackEl.innerHTML = '<span style="color: #f44336;">✗ 틀렸습니다. 가정통신문을 다시 읽어보세요. 정답은 "불법 주정차 문제"입니다.</span>'
        }
      }
      
      checkStage1Complete()
      
      // 드래그한 옵션 제거 (선택적)
      draggableOptions.forEach(opt => {
        if (opt.dataset.option === selectedOption) {
          opt.style.opacity = '0.5'
          opt.style.pointerEvents = 'none'
        }
      })
    })
    
    // 저장된 답변 복원
    if (appState.answers.letterProblem) {
      letterAnswerBox.textContent = appState.answers.letterProblem
      letterAnswerBox.style.borderColor = 'var(--winter-blue-500)'
      letterAnswerBox.style.backgroundColor = 'var(--winter-blue-50)'
      
      const feedbackEl = document.getElementById('letter-feedback')
      if (feedbackEl && appState.answers.letterProblem !== '여기에 드래그하세요') {
        if (appState.answers.letterProblem === '불법 주정차 문제') {
          feedbackEl.innerHTML = '<span style="color: #4caf50;">✓ 정답입니다! 가정통신문은 불법 주정차 문제에 대한 내용입니다.</span>'
        } else {
          feedbackEl.innerHTML = '<span style="color: #f44336;">✗ 틀렸습니다. 가정통신문을 다시 읽어보세요. 정답은 "불법 주정차 문제"입니다.</span>'
        }
      }
    }
  }
  
  // 1단계와 2단계: 문제 선택 및 정답 피드백
  const questionOptions = document.querySelectorAll('.question-option')
  questionOptions.forEach(option => {
    option.addEventListener('click', function() {
      const isCorrect = this.dataset.correct === 'true'
      const parent = this.closest('.question-card')
      const questionType = this.classList.contains('stage1-q1') || this.classList.contains('stage2-q1') ? 'q1' : 
                          this.classList.contains('stage1-q2') || this.classList.contains('stage2-q2') ? 'q2' : null
      
      // 같은 질문의 다른 옵션들 선택 해제
      parent.querySelectorAll('.question-option').forEach(opt => {
        opt.classList.remove('selected')
        if (opt.dataset.correct === 'true') {
          opt.classList.remove('correct-answer')
        } else {
          opt.classList.remove('wrong-answer')
        }
      })
      
      // 선택한 옵션 표시
      this.classList.add('selected')
      if (isCorrect) {
        this.classList.add('correct-answer')
      } else {
        this.classList.add('wrong-answer')
        // 정답 표시
        parent.querySelectorAll('.question-option').forEach(opt => {
          if (opt.dataset.correct === 'true') {
            opt.classList.add('correct-answer')
          }
        })
      }
      
      // 피드백 표시
      if (questionType === 'q1') {
        appState.questionAnswers.question1 = this.dataset.answer
        appState.questionAnswers.question1Correct = isCorrect
        appState.answers.question1 = this.dataset.answer
        saveProgress() // 진행 상태 저장
        // 선택한 답변에 따라 시각적 피드백 표시
        if (isCorrect) {
          this.classList.add('correct-answer')
        } else {
          this.classList.add('wrong-answer')
          // 정답 표시
          parent.querySelectorAll('.question-option').forEach(opt => {
            if (opt.dataset.correct === 'true') {
              opt.classList.add('correct-answer')
            }
          })
        }
        // 이유 검증 (최소 5자 이상 입력되어 있으면)
        if (appState.answers.predictionReason && appState.answers.predictionReason.length >= 5) {
          validatePredictionReason()
        } else {
          // 이유가 비어있거나 짧으면 피드백 지우기
          const feedbackEl = document.getElementById('q1-feedback')
          if (feedbackEl) {
            feedbackEl.innerHTML = ''
          }
        }
      } else if (questionType === 'q2') {
        appState.questionAnswers.question2 = this.dataset.answer
        appState.questionAnswers.question2Correct = isCorrect
        const feedbackEl = document.getElementById('q2-feedback')
        if (feedbackEl) {
          feedbackEl.innerHTML = isCorrect 
            ? '<span style="color: #4caf50;">✓ 정답입니다! 11월에 가장 많은 민원이 발생했습니다.</span>'
            : '<span style="color: #f44336;">✗ 틀렸습니다. 정답은 11월입니다.</span>'
        }
        appState.answers.question2 = this.dataset.answer
        saveProgress() // 진행 상태 저장
      }
      
      checkStage1Complete()
      checkStage2Complete()
    })
  })
  
  // 이전 단계로 가는 버튼
  const prevStageBtn = document.getElementById('prev-stage-btn')
  if (prevStageBtn) {
    prevStageBtn.addEventListener('click', async () => {
      if (appState.currentStage > 0) {
        appState.currentStage--
        saveProgress() // 진행 상태 저장
        await renderApp()
        
        if (appState.currentStage === 1) {
          setTimeout(() => {
            renderCharts()
            // 저장된 답변 복원
            restoreQuestionAnswers()
            // 1단계 완료 상태 확인
            checkStage1Complete()
          }, 100)
        } else if (appState.currentStage === 2) {
          setTimeout(() => {
            renderCharts()
            restoreQuestionAnswers()
            checkStage2Complete()
          }, 100)
        }
      }
    })
  }
  
  // 1단계: 2025년 예상 이유 입력
  const predictionReason = document.getElementById('prediction-reason')
  if (predictionReason) {
    predictionReason.addEventListener('input', () => {
      appState.answers.predictionReason = predictionReason.value.trim()
      saveProgress() // 진행 상태 저장
      checkStage1Complete()
      // 이유 입력 시 검증 (최소 5자 이상일 때만)
      if (appState.answers.predictionReason.length >= 5 && appState.answers.question1) {
        validatePredictionReason()
      } else {
        // 이유가 비어있거나 짧으면 피드백 지우기
        const feedbackEl = document.getElementById('q1-feedback')
        if (feedbackEl) {
          feedbackEl.innerHTML = ''
        }
      }
    })
    // 포커스가 벗어날 때도 검증
    predictionReason.addEventListener('blur', () => {
      if (appState.answers.predictionReason.length >= 5 && appState.answers.question1) {
        validatePredictionReason()
      } else {
        // 이유가 비어있거나 짧으면 피드백 지우기
        const feedbackEl = document.getElementById('q1-feedback')
        if (feedbackEl) {
          feedbackEl.innerHTML = ''
        }
      }
    })
  }
  
  // 문제 원인 입력
  const problemCause = document.getElementById('problem-cause')
  if (problemCause) {
    problemCause.addEventListener('input', () => {
      appState.answers.problemCause = problemCause.value.trim()
      saveProgress() // 진행 상태 저장
      checkStage2Complete()
    })
  }
  
  // 3단계: 주요 원인 선택
  const mainCause = document.getElementById('main-cause')
  if (mainCause) {
    mainCause.addEventListener('change', () => {
      appState.answers.mainCause = mainCause.value
      saveProgress() // 진행 상태 저장
      document.getElementById('next-stage-btn').disabled = !mainCause.value
    })
  }
  
  // 4단계: 공약 작성
  const proposalProblem = document.getElementById('proposal-problem')
  const proposalSolution = document.getElementById('proposal-solution')
  const proposalReason = document.getElementById('proposal-reason')
  const combineBtn = document.getElementById('combine-btn')
  
  if (proposalProblem && proposalSolution && proposalReason && combineBtn) {
    const checkComplete = () => {
      combineBtn.disabled = !(proposalProblem.value.trim() && 
                             proposalSolution.value.trim() && 
                             proposalReason.value.trim())
    }
    
    proposalProblem.addEventListener('input', () => {
      appState.proposal.problem = proposalProblem.value.trim()
      saveProgress() // 진행 상태 저장
      checkComplete()
    })
    
    proposalSolution.addEventListener('input', () => {
      appState.proposal.solution = proposalSolution.value.trim()
      saveProgress() // 진행 상태 저장
      checkComplete()
    })
    
    proposalReason.addEventListener('input', () => {
      appState.proposal.reason = proposalReason.value.trim()
      saveProgress() // 진행 상태 저장
      checkComplete()
    })
    
    combineBtn.addEventListener('click', async () => {
      await combineProposal()
    })
  }
  
  // AI 피드백 받기
  const getFeedbackBtn = document.getElementById('get-feedback-btn')
  if (getFeedbackBtn) {
    getFeedbackBtn.addEventListener('click', async () => {
      await getAIFeedback()
    })
  }
  
  // 5단계: 투표
  const ratingBtns = document.querySelectorAll('.rating-btn')
  ratingBtns.forEach(btn => {
    btn.addEventListener('click', async function() {
      // 투표 종료 상태 확인
      const votingStatus = await getVotingStatus()
      if (votingStatus === 'closed') {
        alert('투표가 이미 종료되었습니다. 더 이상 투표할 수 없습니다.')
        return
      }
      
      const proposalIndex = parseInt(this.dataset.proposal)
      const criteria = this.dataset.criteria
      const score = parseInt(this.dataset.score)
      
      if (!appState.votes[proposalIndex]) {
        appState.votes[proposalIndex] = {}
      }
      
      // 같은 기준의 다른 버튼들 해제
      const parent = this.parentElement
      parent.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
      this.classList.add('selected')
      
      appState.votes[proposalIndex][criteria] = score
      saveProgress() // 진행 상태 저장
      
      // 모든 투표가 완료되었는지 확인
      checkVotingComplete()
    })
  })
  
  // 투표 제출
  const submitVotesBtn = document.getElementById('submit-votes-btn')
  if (submitVotesBtn) {
    submitVotesBtn.addEventListener('click', async () => {
      await submitVotes()
    })
  }
  
  // 다음 단계 버튼
  const nextStageBtn = document.getElementById('next-stage-btn')
  if (nextStageBtn) {
    nextStageBtn.addEventListener('click', async () => {
      if (appState.currentStage < 8) {
        appState.currentStage++
        saveProgress() // 진행 상태 저장
        await renderApp()
        
        if (appState.currentStage === 6) {
          setTimeout(() => {
            generateSpeech()
          }, 500)
        } else if (appState.currentStage === 1) {
          setTimeout(() => {
            renderCharts()
          }, 100)
        } else if (appState.currentStage === 5) {
          // 5단계 진입 시 제안 불러오기
          await loadProposalsFromFirebase()
          await renderApp()
        }
      }
    })
  }
  
  // 나가기 버튼
  const exitBtn = document.getElementById('exit-btn')
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      if (confirm('정말 나가시겠습니까?')) {
        window.location.reload()
      }
    })
  }
  
  // 관리자 페이지 버튼들
  const refreshDataBtn = document.getElementById('refresh-data-btn')
  if (refreshDataBtn) {
    refreshDataBtn.addEventListener('click', async () => {
      await renderApp()
      alert('데이터를 새로고침했습니다.')
    })
  }
  
  const clearDataBtn = document.getElementById('clear-data-btn')
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
      await clearAllData()
    })
  }
  
  // 투표 종료 버튼
  const closeVotingBtn = document.getElementById('close-voting-btn')
  if (closeVotingBtn) {
    closeVotingBtn.addEventListener('click', async () => {
      if (confirm('투표를 종료하고 결과를 확정하시겠습니까?\n\n종료 후에는 학생들이 더 이상 투표할 수 없습니다.')) {
        await closeVoting()
        alert('✅ 투표가 종료되었습니다. 현재 결과가 최종 결과로 확정되었습니다.')
        await renderApp()
      }
    })
  }
  
  // 투표 재개 버튼
  const openVotingBtn = document.getElementById('open-voting-btn')
  if (openVotingBtn) {
    openVotingBtn.addEventListener('click', async () => {
      if (confirm('투표를 다시 시작하시겠습니까?\n\n학생들이 다시 투표할 수 있게 되며, 6단계의 1등 결과는 숨겨집니다.\n\n(데모 목적으로 여러 번 반복할 수 있습니다)')) {
        await openVoting()
        alert('✅ 투표가 다시 시작되었습니다!\n\n학생들이 다시 투표할 수 있으며, 6단계에서는 투표 진행 중 메시지가 표시됩니다.')
        await renderApp()
      }
    })
  }
  
  const backToMainBtn = document.getElementById('back-to-main-btn')
  const backToMainBtn2 = document.getElementById('back-to-main-btn-2')
  if (backToMainBtn) {
    backToMainBtn.addEventListener('click', () => {
      appState.currentStage = 0
      appState.studentName = ''
      saveProgress()
      renderApp()
    })
  }
  if (backToMainBtn2) {
    backToMainBtn2.addEventListener('click', () => {
      appState.currentStage = 0
      appState.studentName = ''
      saveProgress()
      renderApp()
    })
  }
  
  // 개별 제안 삭제 버튼들
  const deleteProposalBtns = document.querySelectorAll('[id^="delete-proposal-btn-"]')
  deleteProposalBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const proposalId = btn.dataset.proposalId
      const studentName = btn.dataset.proposalName
      await deleteProposal(proposalId, studentName)
    })
  })
}

// 차트 렌더링
function renderCharts() {
  if (!appState.parkingData) return
  
  // 꺾은선 그래프
  const lineCtx = document.getElementById('line-chart')
  if (lineCtx) {
    const years = appState.parkingData.map(row => row.구분)
    const totals = appState.parkingData.map(row => parseInt(row.계))
    
    new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: '민원 건수',
          data: totals,
          borderColor: 'rgb(61, 162, 191)',
          backgroundColor: 'rgba(61, 162, 191, 0.1)',
          tension: 0, // 꺾은선 그래프 (부드러운 곡선 없음)
          fill: true,
          stepped: false
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    })
  }
  
  // 막대 그래프 (2024년 월별)
  const barCtx = document.getElementById('bar-chart')
  if (barCtx) {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    const year2024 = appState.parkingData.find(row => row.구분 === '2024년')
    const monthlyData = months.map(month => parseInt(year2024?.[month] || 0))
    
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: '2024년 월별 민원 건수',
          data: monthlyData,
          backgroundColor: 'rgba(61, 162, 191, 0.6)',
          borderColor: 'rgb(61, 162, 191)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    })
  }
}

// 단계 1 완료 확인
function checkStage1Complete() {
  const btn = document.getElementById('next-stage-btn')
  if (btn && appState.currentStage === 1) {
    const hasLetterProblem = appState.answers.letterProblem && appState.answers.letterProblem !== '여기에 드래그하세요'
    const hasQ1 = appState.answers.question1 || appState.questionAnswers.question1
    const hasQ1Reason = appState.answers.predictionReason && appState.answers.predictionReason.length > 0
    const hasQ2 = appState.answers.question2 || appState.questionAnswers.question2
    btn.disabled = !(hasLetterProblem && hasQ1 && hasQ1Reason && hasQ2)
  }
}

// 단계 2 완료 확인
function checkStage2Complete() {
  const btn = document.getElementById('next-stage-btn')
  if (btn && appState.currentStage === 2) {
    const hasCause = appState.answers.problemCause && appState.answers.problemCause.length > 0
    btn.disabled = !hasCause
  }
}

// 예상 이유 검증 함수
function validatePredictionReason() {
  const selectedAnswer = appState.answers.question1 || appState.questionAnswers.question1
  const reason = appState.answers.predictionReason || ''
  const feedbackEl = document.getElementById('q1-feedback')
  
  if (!selectedAnswer || !feedbackEl) return
  
  // 이유가 비어있거나 너무 짧으면 피드백을 표시하지 않음
  if (!reason || reason.trim().length < 5) {
    feedbackEl.innerHTML = ''
    return
  }
  
  const reasonLower = reason.toLowerCase()
  
  // 줄어든다 관련 키워드
  const decreaseKeywords = ['줄어', '감소', '줄어들', '줄어드는', '줄어들었', '줄어들고', '줄어들어', '2022년부터', '최근 몇 년간', '계속 줄어', '줄어드는 추세', '줄어들었기', '줄어들었으', '줄어들었던']
  
  // 늘어난다 관련 키워드
  const increaseKeywords = ['늘어', '증가', '늘어나', '늘어나는', '늘어났', '늘어나고', '늘어나서', '계속 늘어', '늘어나는 추세', '늘어났기', '늘어났으', '늘어났던']
  
  const hasDecreaseKeyword = decreaseKeywords.some(keyword => reasonLower.includes(keyword.toLowerCase()))
  const hasIncreaseKeyword = increaseKeywords.some(keyword => reasonLower.includes(keyword.toLowerCase()))
  
  if (selectedAnswer === '줄어든다') {
    // 줄어든다는 선택했을 때
    if (hasDecreaseKeyword && !hasIncreaseKeyword) {
      // 정답: 줄어든다는 내용
      feedbackEl.innerHTML = '<span style="color: #4caf50;">✓ 정답입니다! 그래프를 보면 최근 몇 년간 민원이 줄어드는 추세입니다.</span>'
      appState.answers.predictionReasonCorrect = true
    } else if (hasIncreaseKeyword) {
      // 틀림: 늘어난다는 내용 (반대 내용)
      feedbackEl.innerHTML = '<span style="color: #f44336;">✗ 틀렸습니다. 그래프를 보면 최근 몇 년간 민원이 줄어드는 추세입니다. 다시 생각해보세요.</span>'
      appState.answers.predictionReasonCorrect = false
    } else {
      // 불명확 - 키워드가 없으면 피드백 표시하지 않음
      feedbackEl.innerHTML = ''
    }
  } else if (selectedAnswer === '늘어난다') {
    // 늘어난다는 선택했을 때 (선택 자체가 틀림)
    if (hasIncreaseKeyword && !hasDecreaseKeyword) {
      // 이유는 일치하지만 선택이 틀림
      feedbackEl.innerHTML = '<span style="color: #f44336;">✗ 틀렸습니다. 그래프를 보면 최근 몇 년간 민원이 줄어드는 추세입니다. "줄어든다"를 선택하고 다시 생각해보세요.</span>'
      appState.answers.predictionReasonCorrect = false
    } else if (hasDecreaseKeyword) {
      // 선택과 이유가 모두 반대
      feedbackEl.innerHTML = '<span style="color: #f44336;">✗ 틀렸습니다. 그래프를 보면 최근 몇 년간 민원이 줄어드는 추세입니다. "줄어든다"를 선택하고 다시 생각해보세요.</span>'
      appState.answers.predictionReasonCorrect = false
    } else {
      // 불명확 - 키워드가 없으면 피드백 표시하지 않음
      feedbackEl.innerHTML = ''
    }
  }
}

// 저장된 질문 답변 복원
function restoreQuestionAnswers() {
  // 1단계 질문 복원
  if (appState.questionAnswers.question1) {
    const q1Options = document.querySelectorAll('.stage1-q1, .stage2-q1')
    q1Options.forEach(opt => {
      if (opt.dataset.answer === appState.questionAnswers.question1) {
        opt.classList.add('selected')
        if (opt.dataset.correct === 'true') {
          opt.classList.add('correct-answer')
        } else {
          opt.classList.add('wrong-answer')
          // 정답 표시
          q1Options.forEach(o => {
            if (o.dataset.correct === 'true') {
              o.classList.add('correct-answer')
            }
          })
        }
      }
    })
  }
  
  // 1단계 예상 이유 복원
  if (appState.answers.predictionReason) {
    const predictionReasonEl = document.getElementById('prediction-reason')
    if (predictionReasonEl) {
      predictionReasonEl.value = appState.answers.predictionReason
      // 복원 후 검증
      if (appState.answers.question1) {
        validatePredictionReason()
      }
    }
  }
  
  if (appState.questionAnswers.question2) {
    const q2Options = document.querySelectorAll('.stage1-q2, .stage2-q2')
    q2Options.forEach(opt => {
      if (opt.dataset.answer === appState.questionAnswers.question2) {
        opt.classList.add('selected')
        if (opt.dataset.correct === 'true') {
          opt.classList.add('correct-answer')
        } else {
          opt.classList.add('wrong-answer')
          // 정답 표시
          q2Options.forEach(o => {
            if (o.dataset.correct === 'true') {
              o.classList.add('correct-answer')
            }
          })
        }
      }
    })
    const q2Feedback = document.getElementById('q2-feedback')
    if (q2Feedback) {
      q2Feedback.innerHTML = appState.questionAnswers.question2Correct
        ? '<span style="color: #4caf50;">✓ 정답입니다! 11월에 가장 많은 민원이 발생했습니다.</span>'
        : '<span style="color: #f44336;">✗ 틀렸습니다. 정답은 11월입니다.</span>'
    }
  }
}

// 공약문 연결
async function combineProposal() {
  const problem = appState.proposal.problem
  const solution = appState.proposal.solution
  const reason = appState.proposal.reason
  
  if (!problem || !solution || !reason) return
  
  const prompt = `
다음 정보를 자연스럽게 연결해서 초등학생 4학년이 쓴 것처럼 공약문을 작성해주세요:

문제 상황: ${problem}
해결방안: ${solution}
이유: ${reason}

형식:
"우리 동네에서는 [문제 상황] 문제가 있습니다.
저는 이 문제를 해결하기 위해 [해결방안]을/를 제안합니다.
왜냐하면 [이유] 때문입니다."

문장을 자연스럽게 연결하고 다듬어주세요. 초등학생 4학년 수준의 쉬운 말로 작성해주세요.
  `
  
  try {
    const combinedText = await callOpenAI(prompt, '당신은 초등학교 4학년 학생의 글을 도와주는 친절한 선생님입니다.')
    
    document.getElementById('combined-text').textContent = combinedText
    document.getElementById('combined-proposal').classList.remove('hidden')
    appState.proposal.combinedText = combinedText
    
    // Firebase에 제안 저장
    const myProposal = {
      name: appState.studentName,
      problem: problem,
      solution: solution,
      reason: reason,
      combinedText: combinedText,
      text: combinedText,
      // 2단계 데이터 추가
      problemCause: appState.answers.problemCause || '',
      mainCause: appState.answers.mainCause || '',
      timestamp: new Date().toISOString()
    }
    
    try {
      // 기존 제안 확인
      const proposals = await loadProposalsFromFirebase()
      const existingProposal = proposals.find(p => p.name === appState.studentName)
      
      if (existingProposal) {
        // 기존 제안 업데이트
        const proposalRef = ref(db, `proposals/${existingProposal.id}`)
        await update(proposalRef, myProposal)
      } else {
        // 새 제안 추가
        const proposalsRef = ref(db, 'proposals')
        await push(proposalsRef, myProposal)
      }
      
      // 삭제 목록에서 제거 (제안을 다시 작성했으므로)
      if (db) {
        try {
          const deletedProposals = await loadDeletedProposals()
          const filteredDeleted = deletedProposals.filter(name => name !== appState.studentName)
          const deletedRef = ref(db, 'deletedProposals')
          await set(deletedRef, filteredDeleted)
          localStorage.setItem('deletedProposals', JSON.stringify(filteredDeleted))
        } catch (error) {
          console.error('삭제 목록 업데이트 실패:', error)
        }
      } else {
        const deleted = JSON.parse(localStorage.getItem('deletedProposals') || '[]')
        const filteredDeleted = deleted.filter(name => name !== appState.studentName)
        localStorage.setItem('deletedProposals', JSON.stringify(filteredDeleted))
      }
      
      // 로컬 상태 업데이트
      const updatedProposals = await loadProposalsFromFirebase()
      appState.allProposals = updatedProposals
    } catch (error) {
      console.error('제안 저장 실패:', error)
      // Firebase 실패 시 localStorage에 저장
      const allProposals = JSON.parse(localStorage.getItem('allProposals') || '[]')
      const existingIndex = allProposals.findIndex(p => p.name === appState.studentName)
      if (existingIndex >= 0) {
        allProposals[existingIndex] = myProposal
      } else {
        allProposals.push(myProposal)
      }
      localStorage.setItem('allProposals', JSON.stringify(allProposals))
      appState.allProposals = allProposals
      alert('Firebase 저장에 실패했습니다. 로컬에 저장되었습니다.')
    }
  } catch (error) {
    alert('문장 연결 중 오류가 발생했습니다: ' + error.message)
  }
}

// AI 피드백 받기
async function getAIFeedback() {
  const feedbackContainer = document.getElementById('ai-feedback-container')
  const feedbackBtn = document.getElementById('get-feedback-btn')
  
  if (feedbackContainer) {
    feedbackContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>피드백을 생성하고 있습니다...</p></div>'
    feedbackContainer.classList.remove('hidden')
    feedbackBtn.disabled = true
  }
  
  const proposal = appState.proposal
  
  const systemPrompt = `당신은 초등학교 4학년 학생들에게 사회 교과서 내용을 바탕으로 해결방안에 대해 피드백을 주는 친절한 선생님입니다. 
항상 격려하고, 구체적이고 이해하기 쉬운 말로 설명합니다.`

  const prompt = `
초등학교 4학년 학생이 작성한 해결방안에 대해 피드백을 주세요.

[학생의 제안]
문제 상황: ${proposal.problem}
해결방안: ${proposal.solution}
이유: ${proposal.reason}

[교과서에서 배운 주요 해결방안 예시]
1. 주차 공간을 효율적으로 활용하기 (예: 시간대별 주차장 개방)
2. 불법 주차 단속을 강화하기 (예: 감시 카메라 증가)
3. 주민들의 인식 개선 캠페인 실시
4. 주차 공간을 늘리기 (하지만 공간 확보가 어려울 수 있음)

[평가 기준]
- 내용상 충족했는지: 문제 상황, 해결방안, 이유가 모두 명확한가?
- 조건상 충족했는지: 초등학생 4학년 수준에서 실천 가능한가?

초등학생 4학년 수준으로 쉽고 친절하게 피드백을 작성해주세요. 
격려하는 말과 함께, 잘한 점과 더 생각해볼 점을 구체적으로 알려주세요.
  `
  
  try {
    const feedback = await callOpenAI(prompt, systemPrompt)
    
    if (feedbackContainer) {
      feedbackContainer.innerHTML = `
        <div class="ai-feedback">
          <h3>🤖 AI 선생님의 피드백</h3>
          <div class="ai-feedback-content">${feedback.replace(/\n/g, '<br>')}</div>
        </div>
      `
      appState.aiFeedback = feedback
    }
    
    document.getElementById('next-stage-btn').classList.remove('hidden')
  } catch (error) {
    if (feedbackContainer) {
      feedbackContainer.innerHTML = `<p style="color: red;">피드백 생성 중 오류가 발생했습니다: ${error.message}</p>`
    }
  } finally {
    if (feedbackBtn) feedbackBtn.disabled = false
  }
}

// 투표 완료 확인
function checkVotingComplete() {
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : JSON.parse(localStorage.getItem('allProposals') || '[]')
  
  const submitBtn = document.getElementById('submit-votes-btn')
  if (!submitBtn) return
  
  let allComplete = true
  proposals.forEach((proposal, index) => {
    const votes = appState.votes[index] || {}
    if (!votes.effect || !votes.cost || !votes.practical || !votes.harmless) {
      allComplete = false
    }
  })
  
  submitBtn.disabled = !allComplete
}

// 투표 제출
async function submitVotes() {
  // 투표 종료 상태 확인
  const votingStatus = await getVotingStatus()
  if (votingStatus === 'closed') {
    alert('투표가 이미 종료되었습니다. 더 이상 투표할 수 없습니다.')
    return
  }
  
  if (!db) {
    // Firebase가 없으면 localStorage에만 저장
    localStorage.setItem('votes', JSON.stringify(appState.votes))
    alert('투표가 완료되었습니다! (로컬 저장)')
    appState.currentStage = 6
    saveProgress()
    await renderApp()
    setTimeout(() => {
      generateSpeech()
    }, 500)
    return
  }
  
  try {
    // Firebase에 투표 저장 (전체 투표 데이터에 현재 학생의 투표 추가)
    const allVotesRef = ref(db, 'votes/all')
    const currentVotes = await loadVotesFromFirebase()
    
    // 현재 학생의 투표를 전체 투표에 추가
    const updatedVotes = {
      ...currentVotes,
      [appState.studentName]: appState.votes
    }
    
    await set(allVotesRef, updatedVotes)
    
    // 로컬 상태 업데이트
    appState.votes = updatedVotes
    
    alert('투표가 완료되었습니다!')
    appState.currentStage = 6
    saveProgress()
    await renderApp()
    
    setTimeout(() => {
      generateSpeech()
    }, 500)
  } catch (error) {
    console.error('투표 저장 실패:', error)
    // Firebase 실패 시 localStorage에 저장
    localStorage.setItem('votes', JSON.stringify(appState.votes))
    alert('투표가 완료되었습니다! (로컬 저장)')
    appState.currentStage = 6
    saveProgress()
    await renderApp()
    
    setTimeout(() => {
      generateSpeech()
    }, 500)
  }
}

// 연설문 생성
async function generateSpeech() {
  const speechContent = document.getElementById('speech-content')
  if (!speechContent) return
  
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : await loadProposalsFromFirebase()
  
  const voteResults = await loadVotesFromFirebase()
  
  // 각 제안의 총점 계산
  // 투표 데이터 구조: { [studentName]: { [proposalIndex]: { effect, cost, practical, harmless } } }
  const proposalScores = proposals.map((proposal, index) => {
    let totalEffect = 0
    let totalCost = 0
    let totalPractical = 0
    let totalHarmless = 0
    let voteCount = 0
    
    // 모든 학생의 투표를 합산
    Object.keys(voteResults).forEach(studentName => {
      const studentVote = voteResults[studentName]
      if (studentVote && studentVote[index]) {
        const vote = studentVote[index]
        totalEffect += vote.effect || 0
        totalCost += vote.cost || 0
        totalPractical += vote.practical || 0
        totalHarmless += vote.harmless || 0
        voteCount++
      }
    })
    
    const total = totalEffect + totalCost + totalPractical + totalHarmless
    return { 
      index, 
      proposal, 
      total, 
      effect: totalEffect, 
      cost: totalCost, 
      practical: totalPractical, 
      harmless: totalHarmless,
      voteCount
    }
  })
  
  proposalScores.sort((a, b) => b.total - a.total)
  const winner = proposalScores[0]
  
  if (!winner || !winner.proposal) {
    speechContent.innerHTML = '<p>1등 해결방안을 찾을 수 없습니다.</p>'
    return
  }
  
  const prompt = `
동작구청장 후보 캠프에서 1등을 한 해결방안을 바탕으로 연설문을 작성해주세요.

[1등 해결방안]
제안자: ${winner.proposal.name}
문제 상황: ${winner.proposal.problem || '학교 앞 학부모들이 불법 주정차하면서 민원이 발생하고 또 도로가 혼잡해지고, 사고 위험이 높아지는 문제'}
해결방안: ${winner.proposal.solution}
이유: ${winner.proposal.reason}

[연설문에 포함할 내용]
1. 문제 상황 설명
2. 제안하는 내용
3. 제안하는 이유

초등학교 학생들이 듣기에 적합한 연설문을 작성해주세요. 
격려하고 희망적인 톤으로, 그리고 구체적이고 이해하기 쉽게 작성해주세요.
연설문 형식으로 작성해주세요 (인사말, 본문, 결말 포함).
  `
  
  try {
    const speech = await callOpenAI(prompt, '당신은 초등학생들을 대상으로 한 연설문을 작성하는 전문가입니다.')
    
    speechContent.innerHTML = `<div class="speech-content">${speech.replace(/\n/g, '<br>')}</div>`
    document.getElementById('next-stage-btn').classList.remove('hidden')
  } catch (error) {
    speechContent.innerHTML = `<p style="color: red;">연설문 생성 중 오류가 발생했습니다: ${error.message}</p>`
  }
}

// 진행 상태 저장
function saveProgress() {
  try {
    localStorage.setItem('currentStage', appState.currentStage.toString())
    localStorage.setItem('studentName', appState.studentName)
    localStorage.setItem('appStateAnswers', JSON.stringify(appState.answers))
    localStorage.setItem('appStateProposal', JSON.stringify(appState.proposal))
    localStorage.setItem('appStateQuestionAnswers', JSON.stringify(appState.questionAnswers))
    localStorage.setItem('appStateVotes', JSON.stringify(appState.votes))
  } catch (error) {
    console.error('진행 상태 저장 실패:', error)
  }
}

// 진행 상태 복원
function loadProgress() {
  try {
    const savedStage = localStorage.getItem('currentStage')
    const savedName = localStorage.getItem('studentName')
    const savedAnswers = localStorage.getItem('appStateAnswers')
    const savedProposal = localStorage.getItem('appStateProposal')
    const savedQuestionAnswers = localStorage.getItem('appStateQuestionAnswers')
    const savedVotes = localStorage.getItem('appStateVotes')
    
    if (savedStage !== null) {
      appState.currentStage = parseInt(savedStage, 10)
    }
    if (savedName !== null) {
      appState.studentName = savedName
    }
    if (savedAnswers !== null) {
      try {
        appState.answers = JSON.parse(savedAnswers)
      } catch (e) {
        console.error('답변 복원 실패:', e)
      }
    }
    if (savedProposal !== null) {
      try {
        appState.proposal = JSON.parse(savedProposal)
      } catch (e) {
        console.error('제안 복원 실패:', e)
      }
    }
    if (savedQuestionAnswers !== null) {
      try {
        appState.questionAnswers = JSON.parse(savedQuestionAnswers)
      } catch (e) {
        console.error('질문 답변 복원 실패:', e)
      }
    }
    if (savedVotes !== null) {
      try {
        appState.votes = JSON.parse(savedVotes)
      } catch (e) {
        console.error('투표 복원 실패:', e)
      }
    }
  } catch (error) {
    console.error('진행 상태 복원 실패:', error)
  }
}

// 초기화
async function init() {
  await checkAPIKey()
  
  // 진행 상태 복원
  loadProgress()
  
  // 복원된 단계가 0이 아니고 학생 이름이 있으면 해당 단계로 이동
  if (appState.currentStage > 0 && appState.studentName) {
    // CSV 데이터가 필요한 단계인 경우 로드
    if (appState.currentStage >= 1 && appState.currentStage <= 4) {
      try {
        if (!appState.parkingData) {
          appState.parkingData = await parseCSV('/illegal_parking.csv')
        }
        if (!appState.cctvData) {
          appState.cctvData = await parseCSV('/cctv.csv')
        }
      } catch (error) {
        console.error('CSV 데이터 로드 실패:', error)
      }
    }
    
    // 5단계 이상인 경우 제안 불러오기
    if (appState.currentStage >= 5) {
      try {
        await loadProposalsFromFirebase()
        await loadVotesFromFirebase()
      } catch (error) {
        console.error('Firebase 데이터 로드 실패:', error)
      }
    }
  }
  
  await renderApp()
  
  // 복원된 단계에 따라 추가 작업 수행
  if (appState.currentStage === 1 || appState.currentStage === 2) {
    setTimeout(() => {
      renderCharts()
      restoreQuestionAnswers()
      if (appState.currentStage === 1) {
        checkStage1Complete()
      } else if (appState.currentStage === 2) {
        checkStage2Complete()
      }
    }, 100)
  } else if (appState.currentStage === 6) {
    setTimeout(() => {
      generateSpeech()
    }, 500)
  } else if (appState.currentStage === 5) {
    setTimeout(() => {
      setupRealtimeUpdates()
    }, 100)
  }
}

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
