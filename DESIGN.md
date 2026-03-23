# **Warm Efficiency: Design System Manual**

본 매뉴얼은 기술적인 최적화와 가을의 따뜻한 감성을 결합한 **"Warm Efficiency"** 컨셉을 구현하기 위한 가이드라인입니다. 사용자가 데이터 관리 과정에서 차가운 기계적 성능이 아닌, 잘 정돈된 서재에서 기록을 검토하는 듯한 평온함과 신뢰를 느끼도록 설계되었습니다.

## **1\. Design Concept: Warm Efficiency**

* **핵심 가치**: 온기(Warmth), 명료함(Clarity), 유연함(Softness), 신뢰(Trust)  
* **비주얼 목표**: 디지털 대시보드의 효율성을 유지하되, 종이와 나무의 질감을 연상시키는 따뜻한 톤과 여백을 통해 심리적 안정감을 제공합니다.

## **2\. Color Palette**

제공된 이미지의 팔레트와 가이드라인을 통합하여 정의합니다.

### **2.1 Core Colors**

| 구분 | 색상명 | Hex Code | 용도 |
| :---- | :---- | :---- | :---- |
| **Primary** | Terracotta | \#E69046 | 브랜드 포인트, 주요 CTA 버튼, 강조 아이콘 |
| **Deep Point** | Burnt Red | \#AA442F | 중요한 경고, 깊은 강조 |
| **Secondary** | Old Lace | \#FDF5E6 | 메인 배경색, 소프트한 분위기 형성 |
| **Accent** | Deep Brown | \#4D2E27 | 메인 텍스트, 검은색 대용 (가독성 증대) |
| **Neutral** | Warm Grey | \#D2C4B2 | 비활성 요소, 경계선, 보조 텍스트 |
| **Success** | Olive Drab | \#6B8E23 | 최적화 완료, 긍정적 피드백 |

### **2.2 Surface & Functional**

* **Surface**: \#FFFFFF (순백색 \- 카드 및 입력창 배경)  
* **Shadow**: rgba(93, 64, 55, 0.05) (연한 브라운톤 그림자)

## **3\. Typography**

가독성과 고전적인 미학을 동시에 확보합니다.

### **3.1 Heading (제목)**

* **Font Family**: Noto Serif KR (또는 Pretendard Bold)  
* **Style**: '기록'과 '서재'의 정체성을 강조할 때 부분적으로 세리프체를 사용합니다.  
* **Usage**: 섹션 타이틀, 대시보드 요약 수치

### **3.2 Body (본문)**

* **Font Family**: Pretendard  
* **Style**: ![][image1] 적용  
* **Usage**: 일반 텍스트, 설명 문구, 리스트 데이터

### **3.3 Data & Code (데이터)**

* **Font Family**: JetBrains Mono  
* **Style**: 고정폭 글꼴을 통해 데이터의 정렬 상태를 명확히 보여줍니다.  
* **Usage**: 데이터베이스 속성값, 쿼리문, 최적화 로그

## **4\. UI Component Guidelines**

### **4.1 Buttons & Inputs**

* **Corner Radius**: 모든 요소에 최소 ![][image2] 이상을 적용하여 부드러운 인상을 줍니다.  
* **Interaction**: 호버(Hover) 시 색상이 급격히 변하기보다, 약간 더 깊은 브라운 톤이 가미되도록 설계합니다.

### **4.2 Card Design**

데이터 영역을 구분하는 핵심 요소입니다.

/\* Card Component Style \*/  
.card {  
  background-color: \#FFFFFF;  
  border: 1px solid \#F1EDE4; /\* 부드러운 베이지 톤의 보더 \*/  
  border-radius: 16px;  
  padding: 24px;  
  box-shadow: 0 4px 20px rgba(93, 64, 55, 0.05); /\* 따뜻한 그림자 \*/  
  transition: transform 0.2s ease;  
}

.card:hover {  
  transform: translateY(-2px);  
}

## **5\. Interaction & UX Strategy**

### **5.1 Motion Design**

* **Concept**: '찻물이 우러나는 속도', '책장이 부드럽게 넘어가는 느낌'  
* **Loading State**: 정적인 회전 톱니바퀴 대신, 면(Surface)이 부드럽게 채워지거나 텍스트가 서서히 선명해지는(Fade-in with Blur) 방식을 지향합니다.

### **5.2 Microcopy (따뜻한 언어)**

기계적인 명령조에서 벗어나 동료가 곁에서 돕는 듯한 톤을 유지합니다.

* **DB 스캔 시**: "데이터를 꼼꼼하게 살펴보고 있어요. 잠시만 기다려 주세요."  
* **완료 시**: "당신의 워크스페이스가 한결 가벼워졌습니다."  
* **오류 발생 시**: "잠시 숨을 고르고 다시 시도해 볼까요?"

### **5.3 White Space (여백의 미)**

* 정보의 밀도를 인위적으로 낮추어 시각적 압박을 줄입니다.  
* 각 카드 사이의 간격(![][image3])을 충분히 확보하여 데이터가 '숨을 쉴 수 있는' 레이아웃을 구성합니다.

## **6\. Visual Assets Reference**

* **Icons**: 외곽선이 둥근 라운드 아이콘 셋을 사용합니다.  
* **Illustrations**: 가을의 정취를 느낄 수 있는 낙엽, 나무 책상, 잉크 펜 등의 메타포를 적절히 배치하여 'Warm Efficiency'의 세계관을 완성합니다.
