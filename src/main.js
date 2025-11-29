import './style.css'

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
  dashboard: null
}

// CSV 파싱 함수
async function parseCSV(url) {
  const response = await fetch(url)
  const text = await response.text()
  const lines = text.trim().split('\n')
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
function renderApp() {
  const app = document.querySelector('#app')
  
  app.innerHTML = `
    <div class="api-status ${appState.apiKeyStatus}">
      API Key: ${appState.apiKeyStatus === 'connected' ? '정상 작동 중' : 
                appState.apiKeyStatus === 'checking' ? '확인 중...' : '연결 실패'}
    </div>
    
    ${renderCurrentStage()}
  `
  
  attachEventListeners()
}

// 현재 단계 렌더링
function renderCurrentStage() {
  switch (appState.currentStage) {
    case 0: return renderStage0()
    case 1: return renderStage1()
    case 2: return renderStage2()
    case 3: return renderStage3()
    case 4: return renderStage4()
    case 5: return renderStage5()
    case 6: return renderStage6()
    case 7: return renderStage7()
    case 8: return renderStage8()
    default: return renderStage0()
  }
}

// 0단계: 이름 입력 및 시작
function renderStage0() {
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">🏛️ 최고의 동작구청장 후보는 누구?</h1>
        <p class="stage-subtitle">동작구 미래 시장 캠프에 참여하신 여러분, 환영합니다!</p>
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
      
      <div class="chart-container">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 20px;">연도별 불법 주정차 민원 현황</h3>
        <canvas id="line-chart"></canvas>
      </div>
      
      <div class="chart-container">
        <h3 style="color: var(--winter-blue-700); margin-bottom: 20px;">2024년 월별 불법 주정차 민원 현황</h3>
        <canvas id="bar-chart"></canvas>
      </div>
      
      <div class="question-card">
        <p style="font-size: 1.1em; color: var(--winter-blue-700); line-height: 1.8;">
          <strong>가정통신문:</strong> 등교시간 학교 앞 불법 주정차 문제가 심각합니다. 
          학생들의 안전을 위해 학부모님들의 협조를 부탁드립니다.
        </p>
        <p style="margin-top: 20px; font-style: italic; color: var(--winter-blue-600);">
          여기서 알 수 있는 사실: 학교 주변에서도 불법 주정차가 지속적으로 발생하고 있습니다.
        </p>
      </div>
      
      <button class="btn" id="next-stage-btn">다음 단계로</button>
    </div>
  `
}

// 2단계: 데이터 분석 문제들
function renderStage2() {
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">📐 2단계: 데이터 분석하기</h1>
        <p class="stage-subtitle">데이터를 보고 문제를 확인해봅시다</p>
      </div>
      
      <div class="question-card">
        <div class="question-title">문제 1: 꺾은선 그래프를 보고 답하세요</div>
        <p style="margin: 15px 0; font-size: 1.1em;">
          전년도보다 민원이 가장 늘어난 해는 언제인가요?
        </p>
        <ul class="question-options">
          <li class="question-option" data-answer="2022년">2022년</li>
          <li class="question-option" data-answer="2023년">2023년</li>
          <li class="question-option" data-answer="2024년">2024년</li>
        </ul>
      </div>
      
      <div class="question-card">
        <div class="question-title">문제 2: 막대그래프를 보고 답하세요</div>
        <p style="margin: 15px 0; font-size: 1.1em;">
          2024년에서 가장 많은 민원이 나온 달은 언제인가요?
        </p>
        <ul class="question-options">
          <li class="question-option" data-answer="10월">10월</li>
          <li class="question-option" data-answer="11월">11월</li>
          <li class="question-option" data-answer="12월">12월</li>
        </ul>
      </div>
      
      <div class="question-card">
        <div class="question-title">문제 3: 데이터 분석 + 예상하기</div>
        <p style="margin: 15px 0; font-size: 1.1em;">
          우리 학교 주변에 불법 주정차 문제가 일어나는 원인은 무엇이라고 생각하나요?<br>
          CSV 파일과 가정통신문을 보고 원인을 예상해서 써보세요.
        </p>
        <textarea id="problem-cause" class="input-field" 
                  placeholder="예: 주차 공간이 부족해서, 주민들이 자기의 편리함만을 생각해서 등..."></textarea>
      </div>
      
      <button class="btn" id="next-stage-btn" disabled>다음 단계로</button>
    </div>
  `
}

// 3단계: 문제의 원인 생각하기
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
        <h1 class="stage-title">🤔 3단계: 문제의 원인 생각하기</h1>
        <p class="stage-subtitle">불법 주정차 문제가 발생하는 원인을 생각해봅시다</p>
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
        <select id="main-cause" class="input-field" style="margin-top: 15px;">
          <option value="">가장 중요한 원인을 선택하세요</option>
          ${expectedAnswers.map(answer => `
            <option value="${answer}">${answer}</option>
          `).join('')}
        </select>
      </div>
      
      <button class="btn" id="next-stage-btn" disabled>다음 단계로</button>
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
      
      <div id="combined-proposal" class="hidden" style="margin-top: 30px;">
        <div class="speech-container">
          <h3 style="color: var(--winter-blue-700); margin-bottom: 15px;">연결된 공약문:</h3>
          <div id="combined-text" style="font-size: 1.1em; line-height: 1.8; color: var(--winter-blue-900);"></div>
        </div>
        
        <button class="btn" id="get-feedback-btn" style="margin-top: 20px;">AI 피드백 받기</button>
      </div>
      
      <div id="ai-feedback-container" class="hidden"></div>
      
      <button class="btn hidden" id="next-stage-btn" style="margin-top: 20px;">다음 단계로 (투표하기)</button>
    </div>
  `
}

// 5단계: 동료 평가/투표
function renderStage5() {
  // 실제로는 Firebase에서 모든 제안을 가져와야 하지만, 
  // 현재는 localStorage에 저장된 것들을 표시
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : JSON.parse(localStorage.getItem('allProposals') || '[]')
  
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
                              data-criteria="effect" data-score="${score}">${score}</button>
                    `).join('')}
                  </td>
                  <td>
                    ${[1, 2, 3, 4, 5].map(score => `
                      <button class="rating-btn" data-proposal="${index}" 
                              data-criteria="cost" data-score="${score}">${score}</button>
                    `).join('')}
                  </td>
                  <td>
                    ${[1, 2, 3, 4, 5].map(score => `
                      <button class="rating-btn" data-proposal="${index}" 
                              data-criteria="practical" data-score="${score}">${score}</button>
                    `).join('')}
                  </td>
                  <td>
                    ${[1, 2, 3, 4, 5].map(score => `
                      <button class="rating-btn" data-proposal="${index}" 
                              data-criteria="harmless" data-score="${score}">${score}</button>
                    `).join('')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
      
      <button class="btn" id="submit-votes-btn" disabled>투표 완료하기</button>
    </div>
  `
}

// 6단계: 1등 해결방안 연설문
function renderStage6() {
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : JSON.parse(localStorage.getItem('allProposals') || '[]')
  
  // 투표 결과 계산 (실제로는 Firebase에서 가져와야 함)
  const voteResults = appState.votes || JSON.parse(localStorage.getItem('votes') || '{}')
  
  // 각 제안의 총점 계산
  const proposalScores = proposals.map((proposal, index) => {
    const votes = voteResults[index] || {}
    const effect = votes.effect || 0
    const cost = votes.cost || 0
    const practical = votes.practical || 0
    const harmless = votes.harmless || 0
    const total = effect + cost + practical + harmless
    return { index, proposal, total, effect, cost, practical, harmless }
  })
  
  // 1등 찾기
  proposalScores.sort((a, b) => b.total - a.total)
  const winner = proposalScores[0]
  
  return `
    <div class="stage-container">
      <div class="stage-header">
        <h1 class="stage-title">🏆 6단계: 1등 해결방안 연설문</h1>
        <p class="stage-subtitle">가장 높은 점수를 받은 해결방안입니다!</p>
      </div>
      
      <div class="speech-container">
        <div class="speech-title">🎉 1등: ${winner.proposal.name}님의 해결방안</div>
        <div style="text-align: center; margin: 30px 0; font-size: 1.3em; color: var(--winter-blue-600);">
          총점: ${winner.total}점
        </div>
        <div class="speech-content" id="speech-content">
          <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 20px;">연설문을 작성하고 있습니다...</p>
          </div>
        </div>
      </div>
      
      <button class="btn hidden" id="next-stage-btn" style="margin-top: 20px;">다음 단계로 (대시보드 보기)</button>
    </div>
  `
}

// 7단계: 개인 대시보드
function renderStage7() {
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : JSON.parse(localStorage.getItem('allProposals') || '[]')
  
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
  
  const votes = appState.votes[myProposalIndex] || JSON.parse(localStorage.getItem('votes') || '{}')[myProposalIndex] || {}
  const effect = votes.effect || 0
  const cost = votes.cost || 0
  const practical = votes.practical || 0
  const harmless = votes.harmless || 0
  const total = effect + cost + practical + harmless
  
  const scores = [
    { label: '효과가 큰가요?', value: effect, max: 5 },
    { label: '비용이 적게 드나요?', value: cost, max: 5 },
    { label: '실천할 수 있나요?', value: practical, max: 5 },
    { label: '피해를 주지 않나요?', value: harmless, max: 5 }
  ]
  
  const maxScore = Math.max(...scores.map(s => s.value))
  const strengths = scores.filter(s => s.value === maxScore && s.value > 0).map(s => s.label)
  
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
        ${scores.map((score, index) => `
          <div class="dashboard-card">
            <h3>${score.label}</h3>
            <div class="dashboard-score">${score.value}</div>
            <div class="dashboard-label">/ ${score.max}점</div>
          </div>
        `).join('')}
        
        <div class="dashboard-card" style="background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%);">
          <h3>총점</h3>
          <div class="dashboard-score" style="color: #ff9800;">${total}</div>
          <div class="dashboard-label">/ 20점</div>
        </div>
      </div>
      
      ${strengths.length > 0 ? `
        <div class="question-card" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
                                         border-left: 5px solid #4caf50;">
          <h3 style="color: #2e7d32; margin-bottom: 15px;">✨ 가장 강점인 부분:</h3>
          <ul style="list-style: none; padding: 0;">
            ${strengths.map(strength => `
              <li style="padding: 10px; margin: 5px 0; font-size: 1.1em; color: #1b5e20;">
                • ${strength}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      
      <button class="btn" id="exit-btn" style="margin-top: 30px;">나가기</button>
    </div>
  `
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
    })
    
    startBtn.addEventListener('click', async () => {
      if (appState.studentName) {
        // 데이터 로드
        try {
          appState.parkingData = await parseCSV('/illegal_parking.csv')
          appState.cctvData = await parseCSV('/cctv.csv')
          appState.currentStage = 1
          renderApp()
          setTimeout(() => {
            renderCharts()
          }, 100)
        } catch (error) {
          alert('데이터를 불러오는데 실패했습니다: ' + error.message)
        }
      }
    })
  }
  
  // 2단계: 문제 선택
  const questionOptions = document.querySelectorAll('.question-option')
  questionOptions.forEach(option => {
    option.addEventListener('click', function() {
      const parent = this.closest('.question-card')
      parent.querySelectorAll('.question-option').forEach(opt => opt.classList.remove('selected'))
      this.classList.add('selected')
      appState.answers[this.dataset.answer] = true
      checkStage2Complete()
    })
  })
  
  // 문제 원인 입력
  const problemCause = document.getElementById('problem-cause')
  if (problemCause) {
    problemCause.addEventListener('input', () => {
      appState.answers.problemCause = problemCause.value.trim()
      checkStage2Complete()
    })
  }
  
  // 3단계: 주요 원인 선택
  const mainCause = document.getElementById('main-cause')
  if (mainCause) {
    mainCause.addEventListener('change', () => {
      appState.answers.mainCause = mainCause.value
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
      checkComplete()
    })
    
    proposalSolution.addEventListener('input', () => {
      appState.proposal.solution = proposalSolution.value.trim()
      checkComplete()
    })
    
    proposalReason.addEventListener('input', () => {
      appState.proposal.reason = proposalReason.value.trim()
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
    btn.addEventListener('click', function() {
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
    nextStageBtn.addEventListener('click', () => {
      if (appState.currentStage < 8) {
        appState.currentStage++
        renderApp()
        
        if (appState.currentStage === 6) {
          setTimeout(() => {
            generateSpeech()
          }, 500)
        } else if (appState.currentStage === 1) {
          setTimeout(() => {
            renderCharts()
          }, 100)
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
          tension: 0.4,
          fill: true
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

// 단계 2 완료 확인
function checkStage2Complete() {
  const btn = document.getElementById('next-stage-btn')
  if (btn) {
    const hasAnswers = Object.keys(appState.answers).length >= 3
    const hasCause = appState.answers.problemCause && appState.answers.problemCause.length > 0
    btn.disabled = !(hasAnswers && hasCause)
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
    
    // localStorage에 저장
    const allProposals = JSON.parse(localStorage.getItem('allProposals') || '[]')
    const myProposal = {
      name: appState.studentName,
      problem: problem,
      solution: solution,
      reason: reason,
      combinedText: combinedText,
      text: combinedText
    }
    
    const existingIndex = allProposals.findIndex(p => p.name === appState.studentName)
    if (existingIndex >= 0) {
      allProposals[existingIndex] = myProposal
    } else {
      allProposals.push(myProposal)
    }
    
    localStorage.setItem('allProposals', JSON.stringify(allProposals))
    appState.allProposals = allProposals
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
  // localStorage에 저장 (실제로는 Firebase에 저장)
  localStorage.setItem('votes', JSON.stringify(appState.votes))
  
  alert('투표가 완료되었습니다!')
  appState.currentStage = 6
  renderApp()
  
  setTimeout(() => {
    generateSpeech()
  }, 500)
}

// 연설문 생성
async function generateSpeech() {
  const speechContent = document.getElementById('speech-content')
  if (!speechContent) return
  
  const proposals = appState.allProposals.length > 0 
    ? appState.allProposals 
    : JSON.parse(localStorage.getItem('allProposals') || '[]')
  
  const voteResults = appState.votes || JSON.parse(localStorage.getItem('votes') || '{}')
  
  // 각 제안의 총점 계산
  const proposalScores = proposals.map((proposal, index) => {
    const votes = voteResults[index] || {}
    const effect = votes.effect || 0
    const cost = votes.cost || 0
    const practical = votes.practical || 0
    const harmless = votes.harmless || 0
    const total = effect + cost + practical + harmless
    return { index, proposal, total, effect, cost, practical, harmless }
  })
  
  proposalScores.sort((a, b) => b.total - a.total)
  const winner = proposalScores[0]
  
  if (!winner || !winner.proposal) {
    speechContent.innerHTML = '<p>1등 해결방안을 찾을 수 없습니다.</p>'
    return
  }
  
  const prompt = `
동작구 미래 시장 캠프에서 1등을 한 해결방안을 바탕으로 연설문을 작성해주세요.

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

// 초기화
async function init() {
  await checkAPIKey()
  renderApp()
}

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
